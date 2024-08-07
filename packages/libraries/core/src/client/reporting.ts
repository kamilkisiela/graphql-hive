import {
  ExecutionResult,
  GraphQLSchema,
  Kind,
  parse,
  print,
  stripIgnoredCharacters,
  visit,
} from 'graphql';
import { getDocumentNodeFromSchema } from '@graphql-tools/utils';
import { version } from '../version.js';
import type { SchemaPublishMutation } from './__generated__/types.js';
import { http } from './http-client.js';
import type { HivePluginOptions } from './types.js';
import { createHiveLogger, logIf } from './utils.js';

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
  const logger = createHiveLogger(pluginOptions.agent?.logger ?? console, '[hive][reporting]');

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

  const endpoint =
    selfHostingOptions?.graphqlEndpoint ??
    reportingOptions.endpoint ??
    'https://app.graphql-hive.com/graphql';

  return {
    async report({ schema }) {
      logger.info(`Publish schema`);
      try {
        const response = await http.post(
          endpoint,
          JSON.stringify({
            query,
            operationName: 'schemaPublish',
            variables: {
              input: {
                sdl: await printToSDL(schema),
                author: reportingOptions.author,
                commit: reportingOptions.commit,
                service: reportingOptions.serviceName ?? null,
                url: reportingOptions.serviceUrl ?? null,
                force: true,
              },
            },
          }),
          {
            headers: {
              'graphql-client-name': 'Hive Client',
              'graphql-client-version': version,
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            logger,
          },
        );

        if (response === null) {
          throw new Error('Empty response');
        }

        const result: ExecutionResult<SchemaPublishMutation> = await response.json();

        if (Array.isArray(result.errors)) {
          throw new Error(result.errors.map(error => error.message).join('\n'));
        }

        const data = result.data!.schemaPublish;

        switch (data.__typename) {
          case 'SchemaPublishSuccess': {
            logger.info(`${data.successMessage ?? 'Published schema'}`);
            return;
          }
          case 'SchemaPublishMissingServiceError': {
            throw new Error('Service name is not defined');
          }
          case 'SchemaPublishMissingUrlError': {
            throw new Error('Service url is not defined');
          }
          case 'SchemaPublishError': {
            logger.info(`Published schema (forced with ${data.errors.total} errors)`);
            data.errors.nodes.slice(0, 5).forEach(error => {
              logger.info(` - ${error.message}`);
            });
            return;
          }
        }
      } catch (error) {
        logger.error(
          `Failed to report schema: ${
            error instanceof Error && 'message' in error ? error.message : error
          }`,
        );
      }
    },
    dispose() {
      return Promise.resolve();
    },
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

const federationV2 = {
  scalars: new Set(['_Any', '_FieldSet']),
  directives: new Set([
    'key',
    'requires',
    'provides',
    'external',
    'shareable',
    'extends',
    'override',
    'inaccessible',
    'tag',
  ]),
  types: new Set(['_Service']),
  queryFields: new Set(['_service', '_entities']),
};

/**
 * Extracts the SDL of a federated service from a GraphQLSchema object
 * We do it to not send federated schema to the registry but only the original schema provided by user
 */
async function extractFederationServiceSDL(schema: GraphQLSchema): Promise<string> {
  const queryType = schema.getQueryType()!;
  const serviceField = queryType.getFields()._service;
  const resolved = await (serviceField.resolve as () => Promise<{ sdl: string }>)();

  if (resolved.sdl.includes('_service')) {
    // It seems that the schema is a federated (v2) schema.
    // The _service field returns the SDL of the whole subgraph, not only the sdl provided by the user.
    // We want to remove the federation specific types and directives from the SDL.
    return print(
      visit(parse(resolved.sdl), {
        ScalarTypeDefinition(node) {
          if (federationV2.scalars.has(node.name.value)) {
            return null;
          }

          return node;
        },
        DirectiveDefinition(node) {
          if (federationV2.directives.has(node.name.value)) {
            return null;
          }

          return node;
        },
        ObjectTypeDefinition(node) {
          if (federationV2.types.has(node.name.value)) {
            return null;
          }

          if (node.name.value === 'Query' && node.fields) {
            return {
              ...node,
              fields: node.fields.filter(field => !federationV2.queryFields.has(field.name.value)),
            };
          }

          return node;
        },
      }),
    );
  }

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
