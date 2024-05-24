import { buildSchema, DocumentNode, GraphQLError, Kind, parse, TypeInfo, validate } from 'graphql';
import PromiseQueue from 'p-queue';
import { z } from 'zod';
import { collectSchemaCoordinates } from '@graphql-hive/core/src/client/collect-schema-coordinates';
import { buildOperationS3BucketKey } from '@hive/cdn-script/artifact-storage-reader';
import { sql as c_sql, ClickHouse } from '../../operations/providers/clickhouse-client';
import { S3Config } from '../../shared/providers/s3-config';

type DocumentRecord = {
  appDeploymentId: string;
  hash: string;
  body: string;
  operationNames: Array<string>;
  schemaCoordinates: Array<string>;
};

const AppDeploymentOperationHashModel = z
  .string()
  .trim()
  .min(3, 'Hash must be at least 3 characters long')
  .max(256, 'Hash must be at most 256 characters long');

const AppDeploymentOperationBodyModel = z.string().min(3, 'Body must be at least 3 character long');

export type BatchProcessEvent = {
  event: 'PROCESS';
  id: string;
  data: {
    schemaSdl: string;
    targetId: string;
    appDeployment: {
      id: string;
      name: string;
      version: string;
    };
    documents: ReadonlyArray<{ hash: string; body: string }>;
  };
};

export type BatchProcessedEvent = {
  event: 'PROCESSED';
  id: string;
  data:
    | {
        type: 'error';
        error: {
          message: string;
          details: {
            /** index of the operation causing an issue */
            index: number;
            /** message with additional details (either parse or validation error) */
            message: string;
          };
        };
      }
    | {
        type: 'success';
      };
};

export class PersistedDocumentIngester {
  private promiseQueue = new PromiseQueue({ concurrency: 30 });

  constructor(
    private clickhouse: ClickHouse,
    private s3: S3Config,
  ) {}

  async processBatch(data: BatchProcessEvent['data']) {
    const schema = buildSchema(data.schemaSdl);
    const typeInfo = new TypeInfo(schema);
    const documents: Array<DocumentRecord> = [];
    // TODO: we need to extract all the schema coordinates from the operations

    let index = 0;
    for (const operation of data.documents) {
      const hashValidation = AppDeploymentOperationHashModel.safeParse(operation.hash);
      const bodyValidation = AppDeploymentOperationBodyModel.safeParse(operation.body);

      if (hashValidation.success === false || bodyValidation.success === false) {
        return {
          type: 'error' as const,
          error: {
            // TODO: we should add more details (what hash is affected etc.)
            message: 'Invalid input, please check the operations.',
            details: {
              index,
              message:
                hashValidation.error?.issues[0].message ??
                bodyValidation.error?.issues[0].message ??
                'Invalid hash or body provided',
            },
          },
        };
      }
      let documentNode: DocumentNode;
      // TODO: error handling
      try {
        documentNode = parse(operation.body);
      } catch (err) {
        if (err instanceof GraphQLError) {
          return {
            type: 'error' as const,
            error: {
              message: 'Failed to parse a GraphQL operation.',
              details: {
                index,
                message: err.message,
              },
            },
          };
        }
        throw err;
      }
      const errors = validate(schema, documentNode, undefined, {
        maxErrors: 1,
      });

      if (errors.length > 0) {
        return {
          type: 'error' as const,
          error: {
            // TODO: we should add more details (what hash is affected etc.)
            message: 'Failed to validate GraphQL operation against schema.',
            details: {
              index,
              message: errors[0].message,
            },
          },
        };
      }

      const operationNames = getOperationNames(documentNode);
      const coordinates = collectSchemaCoordinates({
        documentNode,
        processVariables: false,
        variables: null,
        schema,
        typeInfo,
      });

      documents.push({
        appDeploymentId: data.appDeployment.id,
        hash: operation.hash,
        body: operation.body,
        operationNames,
        schemaCoordinates: Array.from(coordinates),
      });

      index++;
    }

    if (documents.length) {
      await this.insertDocuments({
        targetId: data.targetId,
        appDeployment: data.appDeployment,
        documents: documents,
      });
    }

    return {
      type: 'success' as const,
    };
  }

  /** inserts operations of an app deployment into clickhouse and s3 */
  private async insertDocuments(args: {
    targetId: string;
    appDeployment: {
      name: string;
      version: string;
    };
    documents: Array<DocumentRecord>;
  }) {
    // 1. Insert into clickhouse
    const query = c_sql`
      INSERT INTO "app_deployment_documents" (
        "app_deployment_id"
        , "document_hash"
        , "document_body"
        , "operation_names"
        , "schema_coordinates"
      )
      VALUES ${c_sql.join(
        args.documents.map(
          document =>
            c_sql`(
              ${document.appDeploymentId}
              , ${document.hash}
              , ${document.body}
              , (${c_sql.array(document.operationNames, 'String')})
              , (${c_sql.array(document.schemaCoordinates, 'String')})
            )`,
        ),
        ',',
      )}
      `;

    await this.clickhouse.query({
      query,
      timeout: 10_000,
      queryId: 'insert_app_deployment_documents',
    });

    // 2. Insert into S3

    /** We parallelize and queue the requests. */
    const tasks: Array<Promise<void>> = [];

    for (const document of args.documents) {
      const s3Key = buildOperationS3BucketKey(
        args.targetId,
        args.appDeployment.name,
        args.appDeployment.version,
        document.hash,
      );

      tasks.push(
        this.promiseQueue.add(async () => {
          const response = await this.s3.client.fetch(
            [this.s3.endpoint, this.s3.bucket, s3Key].join('/'),
            {
              method: 'PUT',
              headers: {
                'content-type': 'text/plain',
              },
              body: document.body,
              aws: {
                // This boolean makes Google Cloud Storage & AWS happy.
                signQuery: true,
              },
            },
          );

          if (response.status !== 200) {
            throw new Error(`Failed to upload operation to S3: ${response.statusText}`);
          }
        }),
      );
    }

    await Promise.all(tasks);
  }
}

function getOperationNames(query: DocumentNode): Array<string> {
  const names: Array<string> = [];
  for (const node of query.definitions) {
    if (node.kind === Kind.OPERATION_DEFINITION && node.name?.value) {
      names.push(node.name.value);
    }
  }

  return names;
}
