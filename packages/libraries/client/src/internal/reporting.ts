import { ExecutionResult, GraphQLSchema, Kind, print, stripIgnoredCharacters } from 'graphql';
import { getDocumentNodeFromSchema } from '@graphql-tools/utils';
import type { SchemaPublishMutation } from '../__generated__/types.js';
import { version } from '../version.js';
import { createAgent } from './agent.js';
import type { HivePluginOptions } from './types.js';
import { logIf } from './utils.js';

export interface SchemaReporter {
  report(args: { schema: GraphQLSchema }): void;
  dispose(): Promise<void>;
}

export function createReporting(pluginOptions: HivePluginOptions): SchemaReporter {
  if (!pluginOptions.reporting || pluginOptions.enabled === false) {
    return {
      async report() {},
      async dispose() {},
    };
  }

  const token = pluginOptions.token;
  const selfHostingOptions = pluginOptions.selfHosting;
  const reportingOptions = pluginOptions.reporting;
  const logger = pluginOptions.agent?.logger ?? console;

  logIf(
    typeof reportingOptions.author !== 'string' || reportingOptions.author.length === 0,
    '[hive][reporting] author is missing',
    logger.error,
  );
  logIf(
    typeof reportingOptions.commit !== 'string' || reportingOptions.commit.length === 0,
    '[hive][reporting] commit is missing',
    logger.error,
  );
  logIf(
    typeof token !== 'string' || token.length === 0,
    '[hive][reporting] token is missing',
    logger.error,
  );

  let currentSchema: GraphQLSchema | null = null;
  const agent = createAgent<GraphQLSchema, ExecutionResult<SchemaPublishMutation>>(
    {
      logger,
      ...(pluginOptions.agent ?? {}),
      endpoint:
        selfHostingOptions?.graphqlEndpoint ??
        reportingOptions.endpoint ??
        'https://app.graphql-hive.com/graphql',
      token: token,
      enabled: pluginOptions.enabled,
      debug: pluginOptions.debug,
    },
    {
      prefix: 'reporting',
      data: {
        set(incomingSchema) {
          currentSchema = incomingSchema;
        },
        size() {
          return currentSchema ? 1 : 0;
        },
        clear() {
          currentSchema = null;
        },
      },
      headers() {
        return {
          'Content-Type': 'application/json',
          'graphql-client-name': 'Hive Client',
          'graphql-client-version': version,
        };
      },
      async body() {
        return JSON.stringify({
          query,
          operationName: 'schemaPublish',
          variables: {
            input: {
              sdl: await printToSDL(currentSchema!),
              author: reportingOptions.author,
              commit: reportingOptions.commit,
              service: reportingOptions.serviceName ?? null,
              url: reportingOptions.serviceUrl ?? null,
              force: true,
            },
          },
        });
      },
    },
  );

  return {
    async report({ schema }) {
      try {
        const result = await agent.sendImmediately(schema);

        if (result === null) {
          throw new Error('Empty response');
        }

        if (Array.isArray(result.errors)) {
          throw new Error(result.errors.map(error => error.message).join('\n'));
        }

        const data = result.data!.schemaPublish;

        switch (data.__typename) {
          case 'SchemaPublishSuccess': {
            logger.info(`[hive][reporting] ${data.successMessage ?? 'Published schema'}`);
            return;
          }
          case 'SchemaPublishMissingServiceError': {
            throw new Error('Service name is not defined');
          }
          case 'SchemaPublishMissingUrlError': {
            throw new Error('Service url is not defined');
          }
          case 'SchemaPublishError': {
            logger.info(
              `[hive][reporting] Published schema (forced with ${data.errors.total} errors)`,
            );
            data.errors.nodes.slice(0, 5).forEach(error => {
              logger.info(` - ${error.message}`);
            });
            return;
          }
        }
      } catch (error) {
        logger.error(
          `[hive][reporting] Failed to report schema: ${
            error instanceof Error && 'message' in error ? error.message : error
          }`,
        );
      }
    },
    dispose: agent.dispose,
  };
}

const query = stripIgnoredCharacters(/* GraphQL */ `
  mutation schemaPublish($input: SchemaPublishInput!) {
    schemaPublish(input: $input) {
      __typename
      ... on SchemaPublishSuccess {
        initial
        valid
        successMessage: message
      }
      ... on SchemaPublishError {
        valid
        errors {
          nodes {
            message
          }
          total
        }
      }
      ... on SchemaPublishMissingServiceError {
        missingServiceError: message
      }
      ... on SchemaPublishMissingUrlError {
        missingUrlError: message
      }
    }
  }
`);

/**
 * It's a bit tricky to detect if a schema is federated or not.
 * For now, we just check if the schema has a _service that resolves to `_Service!` (as described in federation spec).
 * This may lead to issues if the schema is not a federated schema but something made by the user (I don't think we will hit that issue soon).
 */
function isFederatedSchema(schema: GraphQLSchema): boolean {
  const queryType = schema.getQueryType();

  if (queryType) {
    const fields = queryType.getFields();

    if (fields._service && fields._service.type.toString() === `_Service!`) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts the SDL of a federated service from a GraphQLSchema object
 * We do it to not send federated schema to the registry but only the original schema provided by user
 */
async function extractFederationServiceSDL(schema: GraphQLSchema): Promise<string> {
  const queryType = schema.getQueryType()!;
  const serviceField = queryType.getFields()._service;
  const resolved = await (serviceField.resolve as () => Promise<{ sdl: string }>)();
  return resolved.sdl;
}

function isSchemaOfCommonNames(schema: GraphQLSchema): boolean {
  const queryType = schema.getQueryType();
  if (queryType && queryType.name !== 'Query') {
    return false;
  }

  const mutationType = schema.getMutationType();
  if (mutationType && mutationType.name !== 'Mutation') {
    return false;
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && subscriptionType.name !== 'Subscription') {
    return false;
  }

  return true;
}

function printSchemaWithDirectives(schema: GraphQLSchema) {
  const doc = getDocumentNodeFromSchema(schema);

  if (schema.description == null && isSchemaOfCommonNames(schema)) {
    // remove the schema definition if it's the default one
    // We do it to avoid sending schema definition to the registry, which may be unwanted by federated services or something
    return print({
      kind: Kind.DOCUMENT,
      definitions: doc.definitions.filter(def => def.kind !== Kind.SCHEMA_DEFINITION),
    });
  }

  return print(doc);
}

async function printToSDL(schema: GraphQLSchema) {
  return stripIgnoredCharacters(
    isFederatedSchema(schema)
      ? await extractFederationServiceSDL(schema)
      : printSchemaWithDirectives(schema),
  );
}
