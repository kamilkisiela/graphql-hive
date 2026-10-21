import {
  buildSchema,
  DirectiveDefinitionNode,
  DocumentNode,
  GraphQLError,
  GraphQLSchema,
  Kind,
  parse,
  print,
  ScalarTypeDefinitionNode,
  TypeInfo,
  validate,
} from 'graphql';
import { Injectable } from 'graphql-modules';
import PromiseQueue from 'p-queue';
import { z } from 'zod';
import { collectSchemaCoordinates, preprocessOperation } from '@graphql-hive/core';
import { buildOperationS3BucketKey } from '@hive/cdn-script/artifact-storage-reader';
import { setErrorSource, traceFn, traceInlineSync } from '@hive/service-common';
import { sql as c_sql, ClickHouse } from '../../operations/providers/clickhouse-client';
import { Logger } from '../../shared/providers/logger';
import { S3Writer } from '../../shared/providers/s3-writer';
import type { R2ErrorTraceSummary, S3WriteMetric } from '../../shared/providers/s3-writer';
import {
  PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS,
  type SerializedWorkerError,
} from './persisted-document-scheduler';

type DocumentRecord = {
  appDeploymentId: string;
  /** hash as provided by the user */
  hash: string;
  /** hash as used by usage reporting */
  internalHash: string;
  body: string;
  operationName: string | null;
  schemaCoordinates: Array<string>;
};

export type PreprocessedDocument = {
  hash: string;
  body: string;
  operationName: string | null;
  schemaCoordinates: ReadonlyArray<string>;
  insightsHash: string;
};

const AppDeploymentOperationHashModel = z
  .string()
  .trim()
  .min(1, 'Hash must be at least 1 characters long')
  .max(128, 'Hash must be at most 128 characters long')
  .regex(
    /^([A-Za-z]|[0-9]|_|-|:)+$/,
    "Operation hash can only contain letters, numbers, '_', ':' and '-'",
  );

const AppDeploymentOperationBodyModel = z.string().min(3, 'Body must be at least 3 character long');

const MCP_DIRECTIVES_DOC = parse(/* GraphQL */ `
  directive @mcpTool(
    name: String!
    description: String
    title: String
    descriptionProvider: String
    meta: _HiveMCPJSON
  ) on QUERY | MUTATION
  directive @mcpDescription(provider: String!) on VARIABLE_DEFINITION | FIELD
  directive @mcpHeader(name: String!) on VARIABLE_DEFINITION
  scalar _HiveMCPJSON
`);

/**
 * Persisted operation documents may use MCP directives (`@mcpTool`, `@mcpDescription`,
 * `@mcpHeader`) and the `JSON` scalar that may not be part of the user's schema.
 * We inject any missing definitions so that `validate()` does not reject the documents
 * for unknown directives or types.
 *
 * Only definitions absent from the SDL are added. When the user already defines an MCP
 * directive (e.g. with a narrower arg set), their definition takes precedence.
 */
function injectMcpDirectives(schemaSdl: string): string {
  const schemaDoc = parse(schemaSdl);

  const mcpNames = new Set(
    MCP_DIRECTIVES_DOC.definitions
      .filter(
        (def): def is DirectiveDefinitionNode | ScalarTypeDefinitionNode =>
          def.kind === Kind.DIRECTIVE_DEFINITION || def.kind === Kind.SCALAR_TYPE_DEFINITION,
      )
      .map(def => def.name.value),
  );

  for (const def of schemaDoc.definitions) {
    if ('name' in def && def.name && mcpNames.has(def.name.value)) {
      mcpNames.delete(def.name.value);
    }
  }

  const missing = MCP_DIRECTIVES_DOC.definitions.filter(def => {
    if (def.kind === Kind.DIRECTIVE_DEFINITION || def.kind === Kind.SCALAR_TYPE_DEFINITION) {
      return mcpNames.has(def.name.value);
    }
    return false;
  });

  if (missing.length === 0) {
    return schemaSdl;
  }

  return schemaSdl + '\n' + print({ kind: Kind.DOCUMENT, definitions: missing });
}

export type BatchProcessEvent = {
  event: 'PROCESS';
  id: string;
  /** W3C trace context of the request, so the worker's spans join its trace. */
  traceContext: Record<string, string>;
  requestId: string | undefined;
  /** When the scheduler posted the message; the worker records how long it waited for a thread. */
  enqueuedAt: number;
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
  s3WriteMetrics: Array<S3WriteMetric>;
  r2ErrorTraceSummary: R2ErrorTraceSummary;
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

export type BatchProcessingErrorEvent = {
  event: 'error';
  id: string;
  error: SerializedWorkerError;
  s3WriteMetrics: Array<S3WriteMetric>;
  r2ErrorTraceSummary: R2ErrorTraceSummary;
};

/** Sent by the scheduler when the request was aborted or timed out; the worker stops that batch. */
export type BatchCancelEvent = {
  event: 'CANCEL';
  id: string;
  reason: string;
};

type DocumentValidationResult =
  | Extract<BatchProcessedEvent['data'], { type: 'error' }>
  | { type: 'ok'; documents: Array<DocumentRecord> };

@Injectable()
export class PersistedDocumentIngester {
  private promiseQueue = new PromiseQueue({ concurrency: 30 });
  private logger: Logger;

  constructor(
    private clickhouse: ClickHouse,
    private s3: S3Writer,
    logger: Logger,
  ) {
    this.logger = logger.child({ source: 'PersistedDocumentIngester' });
  }

  async processBatch(data: BatchProcessEvent['data'], signal: AbortSignal) {
    this.logger.debug(
      'Processing batch. (targetId=%s, appDeploymentId=%s, operationCount=%d)',
      data.targetId,
      data.appDeployment.id,
      data.documents.length,
    );

    const { schema, typeInfo } = this.buildValidationSchema(data);
    const validation = this.validateDocuments(data, schema, typeInfo);

    if (validation.type === 'error') {
      return validation;
    }

    if (validation.documents.length) {
      this.logger.debug(
        'inserting documents into clickhouse and s3. (targetId=%s, appDeployment=%s, documentCount=%d)',
        data.targetId,
        data.appDeployment.id,
        validation.documents.length,
      );

      await this.insertDocuments({
        targetId: data.targetId,
        appDeployment: data.appDeployment,
        documents: validation.documents,
        signal,
      });
    }

    return {
      type: 'success' as const,
    };
  }

  private buildValidationSchema = traceInlineSync<
    [BatchProcessEvent['data']],
    { schema: GraphQLSchema; typeInfo: TypeInfo }
  >(
    'PersistedDocumentIngester.buildSchema',
    {
      initAttributes: data => ({
        'hive.target.id': data.targetId,
        'hive.appDeployment.id': data.appDeployment.id,
        'hive.schema.sdl.length': data.schemaSdl.length,
      }),
    },
    data => {
      const schema = buildSchema(injectMcpDirectives(data.schemaSdl));
      return { schema, typeInfo: new TypeInfo(schema) };
    },
  );

  private validateDocuments = traceInlineSync<
    [BatchProcessEvent['data'], GraphQLSchema, TypeInfo],
    DocumentValidationResult
  >(
    'PersistedDocumentIngester.validateDocuments',
    {
      initAttributes: data => ({
        'hive.target.id': data.targetId,
        'hive.appDeployment.id': data.appDeployment.id,
        'hive.appDeployment.documentCount': data.documents.length,
      }),
      resultAttributes: result =>
        result.type === 'error'
          ? {
              'hive.validation.result': 'error',
              'hive.validation.failed_index': result.error.details.index,
              'hive.validation.error': result.error.message,
            }
          : { 'hive.validation.result': 'ok' },
    },
    (data, schema, typeInfo) => {
      const documents: Array<DocumentRecord> = [];

      let index = 0;
      for (const operation of data.documents) {
        const hashValidation = AppDeploymentOperationHashModel.safeParse(operation.hash);
        const bodyValidation = AppDeploymentOperationBodyModel.safeParse(operation.body);

        if (hashValidation.success === false || bodyValidation.success === false) {
          this.logger.debug(
            'Invalid operation provided. Processing failed. (targetId=%s, appDeploymentId=%s, operationIndex=%d)',
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
        try {
          documentNode = parse(operation.body);
        } catch (err) {
          if (err instanceof GraphQLError) {
            console.error(err);
            this.logger.debug(
              'Failed parsing GraphQL operation. (targetId=%s, appDeploymentId=%s, operationIndex=%d)',
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
            'GraphQL operation did not pass validation against latest valid schema version. (targetId=%s, appDeploymentId=%s, operationIndex=%d)',
            data.targetId,
            data.appDeployment.id,
            index,
          );

          return {
            type: 'error' as const,
            error: {
              message: 'The GraphQL operation is not valid against the latest schema version.',
              details: {
                index,
                message: errors[0].message,
              },
            },
          };
        }

        const operationNames = getOperationNames(documentNode);
        if (operationNames.length > 1) {
          return {
            type: 'error' as const,
            error: {
              message: 'Only one executable operation definition is allowed per document.',
              details: {
                index,
                message:
                  'Multiple operation definitions found. Only one executable operation definition is allowed per document.',
              },
            },
          };
        }

        const operationName = operationNames[0] ?? null;

        const schemaCoordinates = collectSchemaCoordinates({
          documentNode,
          processVariables: false,
          variables: null,
          schema,
          typeInfo,
        });

        const normalizedOperation = preprocessOperation({
          document: documentNode,
          operationName,
          schemaCoordinates,
        });

        documents.push({
          appDeploymentId: data.appDeployment.id,
          hash: operation.hash,
          internalHash: normalizedOperation?.hash ?? operation.hash,
          body: operation.body,
          operationName,
          schemaCoordinates: Array.from(schemaCoordinates),
        });

        index++;
      }

      return { type: 'ok', documents };
    },
  );

  async processPreprocessedBatch(
    data: {
      targetId: string;
      appDeployment: {
        id: string;
        name: string;
        version: string;
      };
      documents: ReadonlyArray<PreprocessedDocument>;
    },
    signal: AbortSignal,
  ) {
    const documents: Array<DocumentRecord> = [];

    for (const [index, document] of data.documents.entries()) {
      const hashValidation = AppDeploymentOperationHashModel.safeParse(document.hash);
      const bodyValidation = AppDeploymentOperationBodyModel.safeParse(document.body);

      if (hashValidation.success === false || bodyValidation.success === false) {
        return {
          type: 'error' as const,
          error: {
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

      documents.push({
        appDeploymentId: data.appDeployment.id,
        hash: document.hash,
        internalHash: document.insightsHash,
        body: document.body,
        operationName: document.operationName,
        schemaCoordinates: Array.from(document.schemaCoordinates),
      });
    }

    if (documents.length) {
      const deadline = withBatchDeadline(signal);
      try {
        await this.insertDocuments({
          targetId: data.targetId,
          appDeployment: data.appDeployment,
          documents,
          signal: deadline.signal,
        });
      } finally {
        deadline.dispose();
      }
    }

    return { type: 'success' as const };
  }

  @traceFn('PersistedDocumentIngester.insertClickHouseDocuments', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.appDeployment.id': args.appDeployment.id,
      'hive.appDeployment.documentCount': args.documents.length,
    }),
  })
  private async insertClickHouseDocuments(args: {
    targetId: string;
    appDeployment: {
      id: string;
    };
    documents: Array<DocumentRecord>;
    signal: AbortSignal;
  }) {
    // 1. Insert into ClickHouse
    this.logger.debug(
      'Inserting documents into ClickHouse. (targetId=%s, appDeployment=%s, documentCount=%d)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );

    await this.clickhouse.insert({
      query: c_sql`
        INSERT INTO "app_deployment_documents" (
          "target_id"
          , "app_deployment_id"
          , "document_hash"
          , "document_body"
          , "operation_name"
          , "schema_coordinates"
          , "hash"
        )
        FORMAT CSV`,
      data: args.documents.map(document => [
        args.targetId,
        document.appDeploymentId,
        document.hash,
        document.body,
        document.operationName ?? '',
        document.schemaCoordinates,
        document.internalHash,
      ]),
      queryId: 'insert_app_deployment_documents',
      // A batch is at most 100 rows and the caller waits for it. Written synchronously it costs
      // only its own rows; in the async queue it was coalesced with other uploads and waited
      // behind other tables' flushes.
      mode: 'sync',
      signal: args.signal,
    });

    this.logger.debug(
      'Inserting documents into ClickHouse finished. (targetId=%s, appDeployment=%s, documentCount=%d)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );
  }

  @traceFn('PersistedDocumentIngester.insertS3Documents', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.appDeployment.id': args.appDeployment.id,
      'hive.appDeployment.documentCount': args.documents.length,
    }),
  })
  private async insertS3Documents(args: {
    targetId: string;
    appDeployment: {
      id: string;
      name: string;
      version: string;
    };
    documents: Array<DocumentRecord>;
    controller: AbortController;
  }) {
    this.logger.debug(
      'Inserting documents into S3. (targetId=%s, appDeployment=%s, documentCount=%d)',
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
        this.promiseQueue.add(
          async () => {
            try {
              const responses = await this.s3.writeConcurrently(s3Key, 'persisted_document', {
                headers: {
                  'content-type': 'text/plain',
                },
                body: document.body,
                signal: args.controller.signal,
              });

              for (const response of responses) {
                if (response.statusCode !== 200) {
                  throw setErrorSource(
                    new Error(
                      `Failed to upload operation to S3 object storage (${response.url}): [${response.statusCode}] ${response.statusMessage}`,
                    ),
                    `s3 ${new URL(response.url).origin}`,
                  );
                }
              }
            } catch (error) {
              // Abort here, not in the caller: p-queue starts the next queued upload as soon as
              // this task settles, which would be before the caller's catch runs.
              args.controller.abort(error);
              throw error;
            }
          },
          { signal: args.controller.signal },
        ),
      );
    }

    await Promise.all(tasks);

    this.logger.debug(
      'Inserting documents into S3 finished. (targetId=%s, appDeployment=%s, documentCount=%d)',
      args.targetId,
      args.appDeployment.id,
      args.documents.length,
    );
  }

  /**
   * Inserts operations of an app deployment into clickhouse and s3.
   * Every request of the batch shares one signal: it aborts when the caller's signal aborts
   * or when the first request fails, so nothing keeps running or retrying after that.
   */
  private async insertDocuments(args: {
    targetId: string;
    appDeployment: {
      id: string;
      name: string;
      version: string;
    };
    documents: Array<DocumentRecord>;
    signal: AbortSignal;
  }) {
    const { signal, ...batch } = args;
    signal.throwIfAborted();

    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      await Promise.all([
        this.insertClickHouseDocuments({ ...batch, signal: controller.signal }),
        this.insertS3Documents({ ...batch, controller }),
      ]);
    } catch (error) {
      controller.abort(error);
      throw signal.aborted ? signal.reason : error;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

/**
 * Batches processed by the worker are bounded by the scheduler. Preprocessed batches run on the
 * main thread with only the request's signal, so the same budget is applied here.
 */
function withBatchDeadline(signal: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);

  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener('abort', onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort(
      setErrorSource(
        // got reports an abort whose reason is named TimeoutError as a timeout, so the storage
        // spans record a deadline rather than a cancellation.
        Object.assign(new Error('Timeout, persisted documents were not written within time.'), {
          name: 'TimeoutError',
        }),
        'persisted-document-ingester',
      ),
    );
  }, PERSISTED_DOCUMENT_BATCH_TIMEOUT_MS);

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    },
  };
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
