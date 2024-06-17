import { buildSchema, DocumentNode, GraphQLError, Kind, parse, TypeInfo, validate } from 'graphql';
import PromiseQueue from 'p-queue';
import { z } from 'zod';
import { collectSchemaCoordinates } from '@graphql-hive/core/src/client/collect-schema-coordinates';
import { buildOperationS3BucketKey } from '@hive/cdn-script/artifact-storage-reader';
import { ServiceLogger } from '@hive/service-common';
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
  event: 'processedBatch';
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
  private logger: ServiceLogger;

  constructor(
    private clickhouse: ClickHouse,
    private s3: S3Config,
    logger: ServiceLogger,
  ) {
    this.logger = logger.child({ source: 'PersistedDocumentIngester' });
  }

  async processBatch(data: BatchProcessEvent['data']) {
    this.logger.debug(
      'Processing batch. (targetId=%s, appDeploymentId=%s, operationCount=%n)',
      data.targetId,
      data.appDeployment.id,
      data.documents.length,
    );

    const schema = buildSchema(data.schemaSdl);
    const typeInfo = new TypeInfo(schema);
    const documents: Array<DocumentRecord> = [];

    let index = 0;
    for (const operation of data.documents) {
      const hashValidation = AppDeploymentOperationHashModel.safeParse(operation.hash);
      const bodyValidation = AppDeploymentOperationBodyModel.safeParse(operation.body);

      if (hashValidation.success === false || bodyValidation.success === false) {
        this.logger.debug(
          'Invalid operation provided. Processing failed. (targetId=%s, appDeploymentId=%s, operationIndex=%n)',
          data.targetId,
          data.appDeployment.id,
          index,
        );

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
          console.error(err);
          this.logger.debug(
            'Failed parsing GraphQL operation. (targetId=%s, appDeploymentId=%s, operationIndex=%n)',
            data.targetId,
            data.appDeployment.id,
            index,
          );

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
        this.logger.debug(
          'GraphQL operation did not pass validation against latest valid schema version. (targetId=%s, appDeploymentId=%s, operationIndex=%n)',
          data.targetId,
          data.appDeployment.id,
          index,
        );

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
      this.logger.debug(
        'inserting documents into clickhouse and s3. (targetId=%s, appDeployment=%s, documentCount=%n)',
        data.targetId,
        data.appDeployment.id,
        documents.length,
      );

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

  private async insertClickHouseDocuments(args: {
    targetId: string;
    appDeployment: {
      id: string;
    };
    documents: Array<DocumentRecord>;
  }) {
    // 1. Insert into ClickHouse
    this.logger.debug(
      'Inserting documents into ClickHouse. (targetId=%s, appDeployment=%s, documentCount=%n)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );

    await this.clickhouse.insert({
      query: c_sql`
    INSERT INTO "app_deployment_documents" (
      "app_deployment_id"
      , "document_hash"
      , "document_body"
      , "operation_names"
      , "schema_coordinates"
    )
    FORMAT CSV`,
      data: args.documents.map(document => [
        document.appDeploymentId,
        document.hash,
        document.body,
        document.operationNames,
        document.schemaCoordinates,
      ]),
      timeout: 10_000,
      queryId: 'insert_app_deployment_documents',
    });

    this.logger.debug(
      'Inserting documents into ClickHouse finished. (targetId=%s, appDeployment=%s, documentCount=%n)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );
  }

  private async insertS3Documents(args: {
    targetId: string;
    appDeployment: {
      id: string;
      name: string;
      version: string;
    };
    documents: Array<DocumentRecord>;
  }) {
    this.logger.debug(
      'Inserting documents into S3. (targetId=%s, appDeployment=%s, documentCount=%n)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );

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

    this.logger.debug(
      'Inserting documents into S3 finished. (targetId=%s, appDeployment=%s, documentCount=%n)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );
  }

  /** inserts operations of an app deployment into clickhouse and s3 */
  private async insertDocuments(args: {
    targetId: string;
    appDeployment: {
      id: string;
      name: string;
      version: string;
    };
    documents: Array<DocumentRecord>;
  }) {
    await Promise.all([
      // prettier-ignore
      this.insertClickHouseDocuments(args),
      this.insertS3Documents(args),
    ]);
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
