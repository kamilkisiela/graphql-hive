import type { Redis as RedisInstance } from 'ioredis';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { createHash, createHmac } from 'crypto';
import { printSchema, parse, concatAST, visit, print, ASTNode } from 'graphql';
import type { DocumentNode } from 'graphql';
import { validateSDL } from 'graphql/validation/validate.js';
import { composeAndValidate, compositionHasErrors } from '@apollo/federation';
import { stitchSchemas } from '@graphql-tools/stitch';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import { fetch } from '@whatwg-node/fetch';
import retry from 'async-retry';
import { z } from 'zod';
import type {
  SchemaType,
  BuildInput,
  BuildOutput,
  ValidationInput,
  ValidationOutput,
  SupergraphInput,
  SupergraphOutput,
  ExternalComposition,
} from './types';

interface CompositionSuccess {
  type: 'success';
  result: {
    supergraphSdl: string;
    raw: string;
  };
}

interface CompositionFailure {
  type: 'failure';
  result: {
    errors: Array<{
      message: string;
    }>;
  };
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
          errors: z.array(z.object({ message: z.string() }).required()),
        })
        .required(),
    })
    .required(),
]);

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

function toValidationError(error: any) {
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: error as string,
  };
}

interface Orchestrator {
  validate(schemas: ValidationInput, external: ExternalComposition): Promise<ValidationOutput>;
  build(schemas: BuildInput, external: ExternalComposition): Promise<BuildOutput>;
  supergraph(schemas: SupergraphInput, external: ExternalComposition): Promise<SupergraphOutput>;
}

function hash(secret: string, alg: string, value: string) {
  return createHmac(alg, secret).update(value, 'utf-8').digest('hex');
}

const createFederation: (
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
  decrypt: (value: string) => string
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
        const body = JSON.stringify(
          schemas.map(schema => {
            return {
              sdl: print(trimDescriptions(parse(schema.raw))),
              name: schema.source,
              url: 'url' in schema && typeof schema.url === 'string' ? schema.url : undefined,
            };
          })
        );
        const signature = hash(decrypt(external.encryptedSecret), 'sha256', body);
        logger.debug('Calling external composition service (url=%s)', external.endpoint);
        const response = await retry(
          async () => {
            const response = await fetch(external.endpoint, {
              body,
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-hive-signature-256': signature,
              },
            }).catch(error => {
              logger.error(error);

              return Promise.reject(error);
            });

            if (!response.ok) {
              const message = await response.text().catch(_ => Promise.resolve(response.statusText));
              throw new Error(`External composition failure: ${response.status} ${message}`);
            }

            return response;
          },
          {
            retries: 3,
          }
        );

        const result = await response.json();
        const parseResult = EXTERNAL_COMPOSITION_RESULT.safeParse(result);

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

      const result = composeAndValidate(
        schemas.map(schema => {
          return {
            typeDefs: trimDescriptions(parse(schema.raw)),
            name: schema.source,
            url: 'url' in schema && typeof schema.url === 'string' ? schema.url : undefined,
          };
        })
      );

      if (compositionHasErrors(result)) {
        return {
          type: 'failure',
          result: {
            errors: result.errors.map(toValidationError),
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
    logger
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

      if (result.type === 'failure') {
        throw new Error(
          [`Schemas couldn't be merged:`, result.result.errors.map(error => `\t - ${error.message}`)].join('\n')
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
    const errors = validateSDL(parse(schema.raw)).map(toValidationError);

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

const createStitching: (redis: RedisInstance, logger: FastifyLoggerInstance) => Orchestrator = (redis, logger) => {
  const stitchAndPrint = reuse(
    async (schemas: ValidationInput) => {
      return printSchema(
        stitchSchemas({
          typeDefs: schemas.map(schema => trimDescriptions(parse(schema.raw))),
        })
      );
    },
    'stitching',
    redis,
    logger
  );

  return {
    async validate(schemas) {
      const parsed = schemas.map(s => parse(s.raw));
      const errors = parsed.map(schema => validateStitchedSchema(schema)).flat();

      try {
        await stitchAndPrint(schemas);
      } catch (error) {
        errors.push(toValidationError(error));
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
  const { allStitchingDirectivesTypeDefs } = stitchingDirectives();

  return validateSDL(concatAST([parse(allStitchingDirectivesTypeDefs), doc])).map(toValidationError);
}

export function pickOrchestrator(
  type: SchemaType,
  redis: RedisInstance,
  logger: FastifyLoggerInstance,
  decrypt: (value: string) => string
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
  return createHash('sha256').update(JSON.stringify(input)).update(`key:${uniqueKey}`).digest('hex');
}

async function readAction<O>(
  checksum: string,
  redis: RedisInstance
): Promise<ActionStarted | ActionCompleted<O> | null> {
  const action = await redis.get(`schema-service:${checksum}`);

  if (action) {
    return JSON.parse(action);
  }

  return null;
}

async function startAction(checksum: string, redis: RedisInstance, logger: FastifyLoggerInstance): Promise<boolean> {
  const key = `schema-service:${checksum}`;
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
  logger: FastifyLoggerInstance
): Promise<void> {
  const key = `schema-service:${checksum}`;
  logger.debug('Completing action (checksum=%s)', checksum);
  await redis.setex(
    key,
    60,
    JSON.stringify({
      status: 'completed',
      result: data,
    })
  );
}

async function removeAction(checksum: string, redis: RedisInstance, logger: FastifyLoggerInstance): Promise<void> {
  logger.debug('Removing action (checksum=%s)', checksum);
  const key = `schema-service:${checksum}`;
  await redis.del(key);
}

function reuse<I, O>(
  factory: (input: I) => Promise<O>,
  key: string,
  redis: RedisInstance,
  logger: FastifyLoggerInstance
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
      logger.debug('Waiting action to complete (checksum=%s, time=%s)', checksum, Date.now() - startedAt);
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
