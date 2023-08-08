import { createHmac } from 'crypto';
import type { FastifyRequest } from 'fastify';
import got, { RequestError } from 'got';
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
import { z } from 'zod';
import { composeAndValidate, compositionHasErrors } from '@apollo/federation';
import type { ErrorCode } from '@graphql-hive/external-composition';
import { stitchSchemas } from '@graphql-tools/stitch';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import type { FastifyLoggerInstance } from '@hive/service-common';
import type { Cache } from './cache';
import type {
  ComposeAndValidateInput,
  ComposeAndValidateOutput,
  ExternalComposition,
  SchemaType,
} from './types';

interface BrokerPayload {
  method: 'POST';
  url: string;
  headers: {
    [key: string]: string;
    'x-hive-signature-256': string;
  };
  body: string;
}

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
  composeAndValidate(
    input: ComposeAndValidateInput,
    external: ExternalComposition,
  ): Promise<ComposeAndValidateOutput>;
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

async function callExternalServiceViaBroker(
  broker: {
    endpoint: string;
    signature: string;
  },
  payload: BrokerPayload,
  logger: FastifyLoggerInstance,
  timeoutMs: number,
  requestId: string,
) {
  return callExternalService(
    {
      url: broker.endpoint,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-hive-signature': broker.signature,
        'x-request-id': requestId,
      },
      body: JSON.stringify(payload),
    },
    logger,
    timeoutMs,
  );
}

async function callExternalService(
  input: { url: string; headers: Record<string, string>; body: string },
  logger: FastifyLoggerInstance,
  timeoutMs: number,
) {
  try {
    const response = await got(input.url, {
      method: 'POST',
      headers: input.headers,
      body: input.body,
      responseType: 'text',
      retry: {
        limit: 5,
        methods: ['POST', ...(got.defaults.options.retry.methods ?? [])],
        statusCodes: [404].concat(got.defaults.options.retry.statusCodes ?? []),
        backoffLimit: 500,
      },
      timeout: {
        request: timeoutMs,
      },
    });

    return JSON.parse(response.body) as unknown;
  } catch (error) {
    if (error instanceof RequestError) {
      if (!error.response) {
        logger.info('Network error without response. (%s)', error.message);
        return {
          type: 'failure',
          result: {
            errors: [
              {
                message: `External composition network failure. Is the service reachable?`,
                source: 'graphql',
              },
            ],
          },
        } satisfies CompositionFailure;
      }
      if (error.response) {
        const message = error.response.body ? error.response.body : error.response.statusMessage;

        // If the response is a string starting with ERR_ it's a special error returned by the composition service.
        // We don't want to throw an error in this case, but instead return a failure result.
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

        logger.info(
          'Network error so return failure (status=%s, message=%s)',
          error.response.statusCode,
          error.message,
        );
        return {
          type: 'failure',
          result: {
            errors: [
              {
                message: `External composition network failure: ${error.message}`,
                source: 'graphql',
              },
            ],
          },
        } satisfies CompositionFailure;
      }
    }

    throw error;
  }
}

const createFederation: (
  cache: Cache,
  logger: FastifyLoggerInstance,
  requestId: string,
  decrypt: (value: string) => string,
) => Orchestrator = (cache, logger, requestId, decrypt) => {
  const compose = cache.reuse<
    {
      schemas: ComposeAndValidateInput;
      external: ExternalComposition;
    },
    CompositionSuccess | CompositionFailure
  >('federation', async ({ schemas, external }) => {
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
      logger.debug(
        'Calling external composition service (url=%s, broker=%s)',
        external.endpoint,
        external.broker ? 'yes' : 'no',
      );

      const request = {
        url: external.endpoint,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-hive-signature-256': signature,
        } as const,
        body,
      };

      const parseResult = EXTERNAL_COMPOSITION_RESULT.safeParse(
        await (external.broker
          ? callExternalServiceViaBroker(
              external.broker,
              {
                method: 'POST',
                ...request,
              },
              logger,
              cache.timeoutMs,
              requestId,
            )
          : callExternalService(request, logger, cache.timeoutMs)),
      );

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
  });

  return {
    async composeAndValidate(schemas, external) {
      try {
        const composed = await compose({ schemas, external });

        return {
          errors: composed.type === 'failure' ? composed.result.errors : [],
          sdl: composed.result.raw ?? null,
          supergraph: 'supergraphSdl' in composed.result ? composed.result.supergraphSdl : null,
        };
      } catch (error) {
        if (cache.isTimeoutError(error)) {
          return {
            errors: [
              {
                message: error.message,
                source: 'graphql',
              },
            ],
            sdl: null,
            supergraph: null,
          };
        }

        throw error;
      }
    },
  };
};

function createSingle(): Orchestrator {
  return {
    async composeAndValidate(schemas) {
      const schema = schemas[0];
      const errors = validateSDL(parse(schema.raw)).map(errorWithSource('graphql'));

      return {
        errors,
        sdl: print(trimDescriptions(parse(schema.raw))),
        supergraph: null,
      };
    },
  };
}

const createStitching: (cache: Cache) => Orchestrator = cache => {
  const stitchAndPrint = cache.reuse('stitching', async (schemas: string[]) => {
    return printSchema(
      stitchSchemas({
        subschemas: schemas.map(schema =>
          buildASTSchema(trimDescriptions(parse(schema)), {
            assumeValid: true,
            assumeValidSDL: true,
          }),
        ),
      }),
    );
  });

  return {
    async composeAndValidate(schemas) {
      const parsed = schemas.map(s => parse(s.raw));
      const errors = parsed.map(schema => validateStitchedSchema(schema)).flat();

      let sdl: string | null = null;
      try {
        sdl = await stitchAndPrint(schemas.map(s => s.raw));
      } catch (error) {
        errors.push(toValidationError(error, 'composition'));
      }

      return {
        errors,
        sdl,
        supergraph: null,
      };
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
  cache: Cache,
  req: FastifyRequest,
  decrypt: (value: string) => string,
) {
  switch (type) {
    case 'federation':
      return createFederation(
        cache,
        req.log,
        req.id ?? Math.random().toString(16).substring(2),
        decrypt,
      );
    case 'single':
      return createSingle();
    case 'stitching':
      return createStitching(cache);
    default:
      throw new Error(`Unknown schema type: ${type}`);
  }
}
