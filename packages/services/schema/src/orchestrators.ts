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
import {
  composeServices as nativeComposeServices,
  compositionHasErrors as nativeCompositionHasErrors,
  transformSupergraphToPublicSchema,
} from '@theguild/federation-composition';
import type { ContractsInputType } from './api';
import type { Cache } from './cache';
import {
  applyTagFilterToInaccessibleTransformOnSubgraphSchema,
  type Federation2SubgraphDocumentNodeByTagsFilter,
} from './lib/federation-tag-extraction';
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

export type CompositionErrorSource = 'graphql' | 'composition';

export interface CompositionFailureError {
  message: string;
  source: CompositionErrorSource;
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
  z.object({
    type: z.literal('success'),
    result: z.object({
      supergraph: z.string(),
      sdl: z.string(),
    }),
  }),
  z.object({
    type: z.literal('failure'),
    result: z.object({
      supergraph: z.string().optional(),
      sdl: z.string().optional(),
      errors: z.array(
        z.object({
          message: z.string(),
          source: z
            .union([z.literal('composition'), z.literal('graphql')])
            .optional()
            .transform(value => value ?? 'graphql'),
        }),
      ),
    }),
    includesNetworkError: z.boolean().optional().default(false),
  }),
]);

type ComposerMethodResult = z.TypeOf<typeof EXTERNAL_COMPOSITION_RESULT> & {
  includesNetworkError: boolean;
};

type CompositionErrorType = {
  message: string;
  source: 'composition' | 'graphql';
};

type ContractResultType = {
  id: string;
  result:
    | {
        type: 'success';
        result: {
          supergraph: string;
          sdl: string;
        };
      }
    | {
        type: 'failure';
        result: {
          supergraph?: string;
          sdl?: string;
          errors: Array<CompositionErrorType>;
        };
      };
};

type CompositionResultSuccess = {
  type: 'success';
  result: {
    supergraph: string;
    sdl: string;
    contracts?: Array<ContractResultType>;
  };
};

type CompositionResultFailure = {
  type: 'failure';
  result: {
    supergraph?: string;
    sdl?: string;
    errors: Array<CompositionErrorType>;
  };
};

type CompositionResult = CompositionResultSuccess | CompositionResultFailure;

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
    native: boolean,
    contracts?: ContractsInputType,
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
            sdl: null,
            supergraph: null,
            errors: [
              {
                message: `External composition network failure. Is the service reachable?`,
                source: 'graphql',
              },
            ],
          },
          includesNetworkError: true,
        };
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
              includesNetworkError: true,
            };
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
          includesNetworkError: true,
        };
      }
    }

    throw error;
  }
}

function composeFederationV1(
  subgraphs: Array<{
    typeDefs: DocumentNode;
    name: string;
    url: string | undefined;
  }>,
): ComposerMethodResult {
  const result = composeAndValidate(subgraphs);

  if (compositionHasErrors(result)) {
    return {
      type: 'failure',
      result: {
        errors: result.errors.map(errorWithPossibleCode),
        sdl: result.schema ? printSchema(result.schema) : undefined,
      },
      includesNetworkError: false,
    };
  }

  return {
    type: 'success',
    result: {
      supergraph: result.supergraphSdl,
      sdl: printSchema(result.schema),
    },
    includesNetworkError: false,
  };
}

type SubgraphInput = {
  typeDefs: DocumentNode;
  name: string;
  url: string | undefined;
};

function composeFederationV2(subgraphs: Array<SubgraphInput>): ComposerMethodResult {
  const result = nativeComposeServices(subgraphs);

  if (nativeCompositionHasErrors(result)) {
    return {
      type: 'failure',
      result: {
        errors: result.errors.map(errorWithPossibleCode),
        sdl: undefined,
      },
      includesNetworkError: false,
    } as const;
  }

  return {
    type: 'success',
    result: {
      supergraph: result.supergraphSdl,
      sdl: print(transformSupergraphToPublicSchema(parse(result.supergraphSdl))),
    },
    includesNetworkError: false,
  } as const;
}

async function composeExternalFederation(args: {
  logger: FastifyLoggerInstance;
  subgraphs: Array<SubgraphInput>;
  decrypt: (value: string) => string;
  external: Exclude<ExternalComposition, null>;
  cache: Cache;
  requestId: string;
}): Promise<ComposerMethodResult> {
  args.logger.debug(
    'Using external composition service (url=%s, schemas=%s)',
    args.external.endpoint,
    args.subgraphs.length,
  );
  const body = JSON.stringify(
    args.subgraphs.map(subgraph => {
      return {
        sdl: print(subgraph.typeDefs),
        name: subgraph.name,
        url: 'url' in subgraph && typeof subgraph.url === 'string' ? subgraph.url : undefined,
      };
    }),
  );

  const signature = hash(args.decrypt(args.external.encryptedSecret), 'sha256', body);
  args.logger.debug(
    'Calling external composition service (url=%s, broker=%s)',
    args.external.endpoint,
    args.external.broker ? 'yes' : 'no',
  );

  const request = {
    url: args.external.endpoint,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-hive-signature-256': signature,
    } as const,
    body,
  };

  const parseResult = EXTERNAL_COMPOSITION_RESULT.safeParse(
    await (args.external.broker
      ? callExternalServiceViaBroker(
          args.external.broker,
          {
            method: 'POST',
            ...request,
          },
          args.logger,
          args.cache.timeoutMs,
          args.requestId,
        )
      : callExternalService(request, args.logger, args.cache.timeoutMs)),
  );

  if (!parseResult.success) {
    throw new Error(`External composition failure: invalid shape of data`);
  }

  if (parseResult.data.type === 'success') {
    return {
      type: 'success',
      result: {
        supergraph: parseResult.data.result.supergraph,
        sdl: print(transformSupergraphToPublicSchema(parse(parseResult.data.result.supergraph))),
      },
      includesNetworkError: false,
    };
  }

  return parseResult.data;
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
      native: boolean;
      contracts: ContractsInputType | undefined;
    },
    CompositionResult & {
      includesNetworkError: boolean;
    }
  >(
    'federation',
    async ({ schemas, external, native, contracts }) => {
      const subgraphs = schemas.map(schema => {
        return {
          typeDefs: trimDescriptions(parse(schema.raw)),
          name: schema.source,
          url: 'url' in schema && typeof schema.url === 'string' ? schema.url : undefined,
        };
      });

      let compose: (subgraphs: Array<SubgraphInput>) => Promise<ComposerMethodResult>;

      // Federation v2
      if (native) {
        logger.debug(
          'Using built-in Federation v2 composition service (schemas=%s)',
          schemas.length,
        );
        compose = subgraphs => Promise.resolve(composeFederationV2(subgraphs));
      } else if (external) {
        compose = subgraphs =>
          composeExternalFederation({
            cache,
            decrypt,
            external,
            logger,
            requestId,
            subgraphs,
          });
      } else {
        logger.debug(
          'Using built-in Federation v1 composition service (schemas=%s)',
          schemas.length,
        );
        compose = subgraphs => Promise.resolve(composeFederationV1(subgraphs));
      }

      const result = await compose(subgraphs);

      if (!contracts?.length || result.type === 'failure') {
        return result;
      }

      // Attempt to compose contracts
      const contractResults = await Promise.all(
        contracts.map(async contract => {
          const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
            include: contract.filter.include ? new Set(contract.filter.include) : null,
            exclude: contract.filter.exclude ? new Set(contract.filter.exclude) : null,
          };

          const filteredSubgraphs = subgraphs.map(subgraph => ({
            ...subgraph,
            typeDefs: applyTagFilterToInaccessibleTransformOnSubgraphSchema(
              subgraph.typeDefs,
              filter,
            ),
          }));

          return {
            id: contract.id,
            result: await compose(filteredSubgraphs),
          };
        }),
      );

      const networkErrorContract = contractResults.find(
        contract => contract.result.includesNetworkError === true,
      );

      // In case any of the contract composition fails, we will fail the whole composition.
      if (networkErrorContract) {
        return networkErrorContract.result;
      }

      return {
        ...result,
        result: {
          supergraph: result.result.supergraph,
          sdl: result.result.sdl,
          contracts: contractResults,
        },
      };
    },
    function pickCacheType(result) {
      return 'includesNetworkError' in result && result.includesNetworkError === true
        ? 'short'
        : 'long';
    },
  );

  return {
    async composeAndValidate(schemas, external, native, contracts) {
      try {
        const composed = await compose({ schemas, external, native, contracts });

        return {
          errors: composed.type === 'failure' ? composed.result.errors : [],
          sdl: composed.result.sdl ?? null,
          supergraph: composed.result.supergraph ?? null,
          includesNetworkError:
            composed.type === 'failure' && composed.includesNetworkError === true,
          contracts:
            composed.type === 'success' && composed.result.contracts
              ? composed.result.contracts.map(contract => ({
                  id: contract.id,
                  errors: 'errors' in contract.result.result ? contract.result.result.errors : [],
                  sdl: contract.result.result.sdl ?? null,
                  supergraph: contract.result.result.supergraph ?? null,
                }))
              : null,
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
            includesNetworkError: true,
            contracts: null,
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
        contracts: null,
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
        contracts: null,
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
