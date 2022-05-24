import { GraphQLSchema, stripIgnoredCharacters, print, Kind } from 'graphql';
import { getDocumentNodeFromSchema } from '@graphql-tools/utils';
import { createAgent } from './agent';
import { version } from '../version';
import type { HivePluginOptions } from './types';

export interface SchemaReporter {
  report(args: { schema: GraphQLSchema }): void;
  dispose(): Promise<void>;
}

export function createReporting(pluginOptions: HivePluginOptions): SchemaReporter {
  if (!pluginOptions.reporting) {
    return {
      report() {},
      async dispose() {},
    };
  }

  const token = pluginOptions.token;
  const reportingOptions = pluginOptions.reporting;

  const logger = pluginOptions.agent?.logger ?? console;
  let currentSchema: GraphQLSchema | null = null;
  const agent = createAgent<GraphQLSchema>(
    {
      logger,
      ...(pluginOptions.agent ?? {}),
      endpoint: reportingOptions.endpoint ?? 'https://app.graphql-hive.com/registry',
      token: token,
      enabled: pluginOptions.enabled,
      debug: pluginOptions.debug,
      sendImmediately: true,
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
    }
  );

  return {
    report({ schema }) {
      try {
        agent.capture(schema);
      } catch (error) {
        logger.error(`Failed to report schema`, error);
      }
    },
    dispose: agent.dispose,
  };
}

const query = stripIgnoredCharacters(/* GraphQL */ `
  mutation schemaPublish($input: SchemaPublishInput!) {
    schemaPublish(input: $input) {
      __typename
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
    isFederatedSchema(schema) ? await extractFederationServiceSDL(schema) : printSchemaWithDirectives(schema)
  );
}
