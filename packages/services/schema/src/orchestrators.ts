import { createHash, createHmac } from 'crypto';
import retry from 'async-retry';
import type { DocumentNode } from 'graphql';
import {
  ASTNode,
  buildASTSchema,
  concatAST,
  GraphQLError,
  Kind,
  parse,
  print,
  printSchema,
  visit,
} from 'graphql';
import { validateSDL } from 'graphql/validation/validate.js';
import type { Redis as RedisInstance } from 'ioredis';
import { z } from 'zod';
import { composeAndValidate, compositionHasErrors } from '@apollo/federation';
import type { ErrorCode } from '@graphql-hive/external-composition';
import { stitchSchemas } from '@graphql-tools/stitch';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { fetch } from '@whatwg-node/fetch';
import type {
  BuildInput,
  BuildOutput,
  ExternalComposition,
  SchemaType,
  SupergraphInput,
  SupergraphOutput,
  ValidationInput,
  ValidationOutput,
} from './types';

interface CompositionSuccess {
  type: 'success';
  result: {
    supergraphSdl: string;
    raw: string;
  };
}

export type CompositionErrorSource = 'graphql' | 'composition';

export interface CompositionFailureError {
  message: string;
  source: CompositionErrorSource;
}

interface CompositionFailure {
  type: 'failure';
  result: {
    errors: CompositionFailureError[];
    raw?: string;
  };
}

const { allStitchingDirectivesTypeDefs, stitchingDirectivesValidator } = stitchingDirectives();
const parsedStitchingDirectives = parse(allStitchingDirectivesTypeDefs);
const stitchingDirectivesNames = extractDirectiveNames(parsedStitchingDirectives);

function extractDirectiveNames(doc: DocumentNode) {
  const directives: string[] = [];

  for (const definition of doc.definitions) {
    if (definition.kind === Kind.DIRECTIVE_DEFINITION) {
      directives.push(definition.name.value);
    }
  }

  return directives;
}

function definesStitchingDirective(doc: DocumentNode) {
  return extractDirectiveNames(doc).some(name => stitchingDirectivesNames.includes(name));
}

const EXTERNAL_COMPOSITION_RESULT = z.union([
  z
    .object({
      type: z.literal('success'),
      result: z
        .object({
          supergraph: z.string(),
          sdl: z.string(),
        })
        .required(),
    })
    .required(),
  z
    .object({
      type: z.literal('failure'),
      result: z
        .object({
          errors: z.array(
            z.object({
              message: z.string(),
              source: z
                .union([z.literal('composition'), z.literal('graphql')])
                .optional()
                .transform(value => value ?? 'graphql'),
            }),
          ),
        })
        .required(),
    })
    .required(),
]);

class NetworkError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
  }
}

function trimDescriptions(doc: DocumentNode): DocumentNode {
  function trim<T extends ASTNode>(node: T): T {
    if (node && 'description' in node && node.description) {
      (node.description as any).value = node.description.value.trim();
    }

    return node;
  }

  return visit(doc, {
    SchemaDefinition: trim,
    ObjectTypeDefinition: trim,
    ObjectTypeExtension: trim,
    InterfaceTypeExtension: trim,
    UnionTypeExtension: trim,
    InputObjectTypeExtension: trim,
    EnumTypeExtension: trim,
    SchemaExtension: trim,
    ScalarTypeExtension: trim,
    FieldDefinition: trim,
    InputValueDefinition: trim,
    InterfaceTypeDefinition: trim,
    UnionTypeDefinition: trim,
    EnumTypeDefinition: trim,
    EnumValueDefinition: trim,
    InputObjectTypeDefinition: trim,
    DirectiveDefinition: trim,
  });
}

const emptySource = '*';

function toValidationError(error: any, source: CompositionErrorSource) {
  if (error instanceof GraphQLError) {
    return {
      message: error.message,
      source,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      source,
    };
  }

  return {
    message: error as string,
    source,
  };
}

function errorWithSource(source: CompositionErrorSource) {
  return (error: unknown) => toValidationError(error, source);
}

function errorWithPossibleCode(error: unknown) {
  if (error instanceof GraphQLError && error.extensions?.code) {
    return toValidationError(error, 'composition');
  }

  return toValidationError(error, 'graphql');
}

interface Orchestrator {
  validate(schemas: ValidationInput, external: ExternalComposition): Promise<ValidationOutput>;
  build(schemas: BuildInput, external: ExternalComposition): Promise<BuildOutput>;
  supergraph(schemas: SupergraphInput, external: ExternalComposition): Promise<SupergraphOutput>;
}

function hash(secret: string, alg: string, value: string) {
  return createHmac(alg, secret).update(value, 'utf-8').digest('hex');
}

const codeToExplanationMap: Record<ErrorCode, string> = {
  ERR_EMPTY_BODY: 'The body of the request is empty',
  ERR_INVALID_SIGNATURE: 'The signature is invalid. Please check your secret',
};

function translateMessage(errorCode: string) {
  const explanation = codeToExplanationMap[errorCode as ErrorCode];

  if (explanation) {
    return `(${errorCode}) ${explanation}`;
  }
}

const createFederation: (
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
  decrypt: (value: string) => string,
) => Orchestrator = (redis, logger, decrypt) => {
  const compose = reuse<
    {
      schemas: ValidationInput | SupergraphInput;
      external: ExternalComposition;
    },
    CompositionSuccess | CompositionFailure
  >(
    async ({ schemas, external }) => {
      if (external) {
        logger.debug(
          'Using external composition service (url=%s, schemas=%s)',
          external.endpoint,
          schemas.length,
        );
        const body = JSON.stringify(
          schemas.map(schema => {
            return {
              sdl: print(trimDescriptions(parse(schema.raw))),
              name: schema.source,
              url: 'url' in schema && typeof schema.url === 'string' ? schema.url : undefined,
            };
          }),
        );
        const signature = hash(decrypt(external.encryptedSecret), 'sha256', body);
        logger.debug('Calling external composition service (url=%s)', external.endpoint);

        const init = {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-hive-signature-256': signature,
          },
          body,
        };

        const response: unknown = await retry(
          async () => {
            const res = await (external.broker
              ? fetch(external.broker.endpoint, {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'x-hive-signature': external.broker.signature,
                  },
                  body: JSON.stringify({
                    url: external.endpoint,
                    ...init,
                  }),
                })
              : fetch(external.endpoint, init)
            ).catch(async error => {
              logger.error(error);
              throw error;
            });

            if (!res.ok) {
              const message = await res.text().catch(_ => Promise.resolve(res.statusText));

              // If the response is a string starting with ERR_ it's a special error returned by the composition service.
              // We don't want to throw an error in this case, but instead return a failure result.
              // This is useful for cases where the composition service is not able to compose the schemas for technical reasons,
              // and we do want to pass the error to the user and not do a retry.
              if (typeof message === 'string') {
                const translatedMessage = translateMessage(message);

                if (translatedMessage) {
                  return {
                    type: 'failure',
                    result: {
                      errors: [
                        {
                          message: `External composition failure: ${translatedMessage}`,
                          source: 'graphql',
                        },
                      ],
                    },
                  } satisfies CompositionFailure;
                }
              }

              // If it does not start with ERR_ we throw an error, which will be caught by the retry logic.
              throw new NetworkError(message, res.status);
            }

            return res.json();
          },
          {
            retries: 3,
          },
        ).catch(async error => {
          // The expected error
          if (error instanceof NetworkError) {
            logger.info('Network error so return failure');
            return {
              type: 'failure',
              result: {
                errors: [
                  {
                    message: `External composition network failure: [${error.statusCode}] ${error.message}`,
                    source: 'graphql',
                  },
                ],
              },
            } satisfies CompositionFailure;
          }

          throw error;
        });

        const parseResult = EXTERNAL_COMPOSITION_RESULT.safeParse(await response);

        if (!parseResult.success) {
          throw new Error(`External composition failure: invalid shape of data`);
        }

        if (parseResult.data.type === 'success') {
          return {
            type: 'success',
            result: {
              supergraphSdl: parseResult.data.result.supergraph,
              raw: parseResult.data.result.sdl,
            },
          };
        }

        return parseResult.data;
      }

      logger.debug('Using built-in composition service (schemas=%s)', schemas.length);

      const result = composeAndValidate(
        schemas.map(schema => {
          return {
            typeDefs: trimDescriptions(parse(schema.raw)),
            name: schema.source,
            url: 'url' in schema && typeof schema.url === 'string' ? schema.url : undefined,
          };
        }),
      );

      if (compositionHasErrors(result)) {
        return {
          type: 'failure',
          result: {
            errors: result.errors.map(errorWithPossibleCode),
            raw: result.schema ? printSchema(result.schema) : undefined,
          },
        };
      }

      return {
        type: 'success',
        result: {
          supergraphSdl: result.supergraphSdl,
          raw: printSchema(result.schema),
        },
      };
    },
    'federation',
    redis,
    logger,
  );

  return {
    async validate(schemas, external) {
      const result = await compose({ schemas, external });

      if (result.type === 'failure') {
        return {
          errors: result.result.errors,
        };
      }

      return {
        errors: [],
      };
    },
    async build(schemas, external) {
      const result = await compose({ schemas, external });

      // If `raw` SDL is present, it means that we were able to build a schema, but it still has composition errors
      if (result.result.raw) {
        return {
          raw: result.result.raw,
          source: emptySource,
        };
      }

      if (result.type === 'failure') {
        // If `raw` SDL is present, it means that we were able to build a schema, but it still has composition errors
        if (result.result.raw) {
          return {
            raw: result.result.raw,
            source: emptySource,
          };
        }

        throw new Error(
          [
            `Schemas couldn't be merged:`,
            result.result.errors.map(error => `\t - ${error.message}`),
          ].join('\n'),
        );
      }

      return {
        raw: result.result.raw,
        source: emptySource,
      };
    },
    async supergraph(schemas, external) {
      const result = await compose({ schemas, external });

      return {
        supergraph: 'supergraphSdl' in result.result ? result.result.supergraphSdl : null,
      };
    },
  };
};

const single: Orchestrator = {
  async validate(schemas) {
    const schema = schemas[0];
    const errors = validateSDL(parse(schema.raw)).map(errorWithSource('graphql'));

    return {
      errors,
    };
  },
  async build(schemas) {
    const schema = schemas[0];

    return {
      source: schema.source,
      raw: print(trimDescriptions(parse(schema.raw))),
    };
  },
  async supergraph() {
    throw new Error('Single schema orchestrator does not support supergraph');
  },
};

const createStitching: (redis: RedisInstance, logger: FastifyLoggerInstance) => Orchestrator = (
  redis,
  logger,
) => {
  const stitchAndPrint = reuse(
    async (schemas: ValidationInput) => {
      return printSchema(
        stitchSchemas({
          subschemas: schemas.map(schema =>
            buildASTSchema(trimDescriptions(parse(schema.raw)), {
              assumeValid: true,
              assumeValidSDL: true,
            }),
          ),
        }),
      );
    },
    'stitching',
    redis,
    logger,
  );

  return {
    async validate(schemas) {
      const parsed = schemas.map(s => parse(s.raw));
      const errors = parsed.map(schema => validateStitchedSchema(schema)).flat();

      try {
        await stitchAndPrint(schemas);
      } catch (error) {
        errors.push(toValidationError(error, 'composition'));
      }

      return {
        errors,
      };
    },
    async build(schemas) {
      const raw = await stitchAndPrint(schemas);

      return {
        raw,
        source: emptySource,
      };
    },
    async supergraph() {
      throw new Error('Stitching schema orchestrator does not support supergraph');
    },
  };
};

function validateStitchedSchema(doc: DocumentNode) {
  const definesItsOwnStitchingDirectives = definesStitchingDirective(doc);
  const fullDoc = definesItsOwnStitchingDirectives
    ? doc
    : concatAST([parsedStitchingDirectives, doc]);
  const errors = validateSDL(fullDoc).map(errorWithSource('graphql'));

  // If the schema defines its own stitching directives,
  // it means we can't be sure that it follows the official spec.
  if (definesItsOwnStitchingDirectives) {
    return errors;
  }

  try {
    stitchingDirectivesValidator(
      buildASTSchema(fullDoc, {
        assumeValid: true,
        assumeValidSDL: true,
      }),
    );
  } catch (error) {
    errors.push(toValidationError(error, 'composition'));
  }

  return errors;
}

export function pickOrchestrator(
  type: SchemaType,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
  decrypt: (value: string) => string,
) {
  switch (type) {
    case 'federation':
      return createFederation(redis, logger, decrypt);
    case 'single':
      return single;
    case 'stitching':
      return createStitching(redis, logger);
    default:
      throw new Error(`Unknown schema type: ${type}`);
  }
}

interface ActionStarted {
  status: 'started';
}

interface ActionCompleted<T> {
  status: 'completed';
  result: T;
}

function createChecksum<TInput>(input: TInput, uniqueKey: string): string {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .update(`key:${uniqueKey}`)
    .digest('hex');
}

function createActionKey(checksum: string): string {
  return `schema-service:${checksum}`;
}

async function readAction<O>(
  checksum: string,
  redis: RedisInstance,
): Promise<ActionStarted | ActionCompleted<O> | null> {
  const action = await redis.get(createActionKey(checksum));

  if (action) {
    return JSON.parse(action);
  }

  return null;
}

async function startAction(
  checksum: string,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
): Promise<boolean> {
  const key = createActionKey(checksum);
  logger.debug('Starting action (checksum=%s)', checksum);
  // Set and lock + expire
  const inserted = await redis.setnx(key, JSON.stringify({ status: 'started' }));

  if (inserted) {
    logger.debug('Started action (checksum=%s)', checksum);
    await redis.expire(key, 60);
    return true;
  }

  logger.debug('Action already started (checksum=%s)', checksum);

  return false;
}

async function completeAction<O>(
  checksum: string,
  data: O,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
): Promise<void> {
  const key = createActionKey(checksum);
  logger.debug('Completing action (checksum=%s)', checksum);
  await redis.setex(
    key,
    60,
    JSON.stringify({
      status: 'completed',
      result: data,
    }),
  );
}

async function removeAction(
  checksum: string,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
): Promise<void> {
  logger.debug('Removing action (checksum=%s)', checksum);
  const key = createActionKey(checksum);
  await redis.del(key);
}

function reuse<I, O>(
  factory: (input: I) => Promise<O>,
  key: string,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
): (input: I) => Promise<O> {
  async function reuseFactory(input: I, attempt = 0): Promise<O> {
    const checksum = createChecksum(input, key);

    if (attempt === 3) {
      await removeAction(checksum, redis, logger);
      throw new Error('Tried too many times');
    }

    let cached = await readAction<O>(checksum, redis);

    if (!cached) {
      const started = await startAction(checksum, redis, logger);

      if (!started) {
        return reuseFactory(input, attempt + 1);
      }

      const result = await factory(input).catch(async error => {
        await removeAction(checksum, redis, logger);
        return Promise.reject(error);
      });
      await completeAction(checksum, result, redis, logger);

      return result;
    }

    const startedAt = Date.now();
    while (cached && cached.status !== 'completed') {
      logger.debug(
        'Waiting action to complete (checksum=%s, time=%s)',
        checksum,
        Date.now() - startedAt,
      );
      await new Promise(resolve => setTimeout(resolve, 500));
      cached = await readAction<O>(checksum, redis);

      if (Date.now() - startedAt > 30_000) {
        await removeAction(checksum, redis, logger);
        throw new Error('Timeout after 30s');
      }
    }

    if (!cached) {
      return reuseFactory(input, attempt + 1);
    }

    return cached.result;
  }

  return reuseFactory;
}
