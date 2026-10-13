import { AddressInfo } from 'node:net';
import {
  GraphQLError,
  parse,
  TypeInfo,
  ValidationContext,
  visit,
  visitInParallel,
  visitWithTypeInfo,
  type DocumentNode,
  type FieldNode,
} from 'graphql';
import { createLogger, createYoga } from 'graphql-yoga';
import { pollFor, readOperationsStats, waitForExpectations } from 'testkit/flow';
import { ProjectType } from 'testkit/gql/graphql';
import { initSeed } from 'testkit/seed';
import { getServiceHost } from 'testkit/utils';
import { describe, expect, test } from 'vitest';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { useHive } from '@graphql-hive/gateway-plugin-console-sdk';
import { createGatewayRuntime, GatewayPlugin } from '@graphql-hive/gateway-runtime';
import { unifiedGraphHandler, useQueryPlan } from '@graphql-hive/router-runtime';
import { createServer } from '@hive/service-common';
import { composeServices, ServiceDefinition } from '@theguild/federation-composition';

type ModulesOrSDL = Parameters<typeof buildSubgraphSchema>[0];
const HIVE_INTERNAL_TYPENAME = '__hive_typename__';

async function createSubgraphService(name: string, modulesOrSDL: ModulesOrSDL) {
  const server = await createServer({
    sentryErrorHandler: false,
    log: {
      requests: false,
      level: 'silent',
    },
    name,
  });

  const yoga = createYoga({
    logging: false,
    schema: buildSubgraphSchema(modulesOrSDL),
  });

  server.route({
    // Bind to the Yoga's endpoint to avoid rendering on any path
    url: yoga.graphqlEndpoint,
    method: ['GET', 'POST', 'OPTIONS'],
    handler: (req, reply) => yoga.handleNodeRequestAndResponse(req, reply),
  });
  await server.listen({
    port: 0,
    host: '0.0.0.0',
  });
  return {
    url: 'http://localhost:' + (server.server.address() as AddressInfo).port + yoga.graphqlEndpoint,
    [Symbol.asyncDispose]: () => {
      server.close();
    },
  };
}

async function setup(
  subgraphs: {
    [key: string]: {
      typeDefs: DocumentNode;
      resolvers: any;
    };
  },
  gatewayType: 'js' | 'rust',
  additionalPlugins?: GatewayPlugin[],
) {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const {
    createTargetAccessToken,
    waitForRequestsCollected,
    readSchemaCoordinateStats,
    target,
    readErrorCodes,
  } = await createProject(ProjectType.Single);
  const token = await createTargetAccessToken({});
  const usageAddress = await getServiceHost('usage', 8081);
  const plugin = useHive({
    enabled: true,
    token: token.secret,
    reporting: false,
    usage: {
      fieldLevelMetricsEnabled: true,
    },
    agent: {
      logger: createLogger('debug'),
      maxSize: 1,
    },
    selfHosting: {
      usageEndpoint: 'http://' + usageAddress,
      graphqlEndpoint: 'http://noop/',
      applicationUrl: 'http://noop/',
    },
    logger: createLogger('debug') as any,
  });

  const services = await Promise.all(
    Object.entries(subgraphs).map(async ([name, def]): Promise<ServiceDefinition> => {
      const service = await createSubgraphService(name, def);
      return {
        name,
        typeDefs: def.typeDefs,
        url: service.url,
      };
    }),
  );
  const supergraph = composeServices(services);
  expect(supergraph.errors).toBeUndefined();
  const jsGateway = createGatewayRuntime({
    supergraph: supergraph.supergraphSdl!,
    plugins: () => [plugin, ...(additionalPlugins ?? [])],
  });

  const rustGateway = createGatewayRuntime({
    unifiedGraphHandler: unifiedGraphHandler as any,
    supergraph: supergraph.supergraphSdl!,
    plugins: () => [plugin, useQueryPlan() as any, ...(additionalPlugins ?? [])],
  });

  return {
    target,
    gateway: gatewayType === 'js' ? jsGateway : rustGateway,
    waitForRequestsCollected,
    readSchemaCoordinateStats,
    readErrorCodes,
    token,
  };
}

describe.each(['js', 'rust'] as const)('GraphQL Hive Plugin (%s)', gatewayType => {
  test('usage data includes subgraph request data', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            price: Int
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return { id: 1, price: 20.2 };
            },
          },
        },
      },
    };

    const { readSchemaCoordinateStats, target, gateway, token, waitForRequestsCollected } =
      await setup(subgraphs, gatewayType);

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            product {
              id
            }
          }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(request);
    await expect(result.json()).resolves.toMatchInlineSnapshot(`
      {
        data: {
          product: {
            id: 1,
          },
        },
      }
    `);
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await pollFor(async () => {
      const operationsStatsResult = await readOperationsStats(
        { byId: target.id },
        period,
        {},
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());
      const stats = await readSchemaCoordinateStats('Query.product', period);

      return (
        stats.target?.schemaCoordinateStats.totalResolutions === 1 &&
        stats.target?.schemaCoordinateStats.totalRequests === 1 &&
        stats.target?.schemaCoordinateStats.totalFailures === 0 &&
        operationsStatsResult.target?.operationsStats.operations.edges[0].node.count === 1
      );
    });
  });

  test('usage data includes subgraph request data, and supports multiple subgraphs', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            price: Int
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return { id: 1, price: 20.2 };
            },
          },
        },
      },
      users: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            users: [User]
          }
          type User {
            id: ID!
            name: String
          }
        `),
        resolvers: {
          Query: {
            users: () => [{ id: 2 }],
          },
          User: {
            name: () => 'test',
          },
        },
      },
    };

    const { readSchemaCoordinateStats, target, gateway, token, waitForRequestsCollected } =
      await setup(subgraphs, gatewayType);

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            product {
              id
            }
            users {
              id
              name
            }
          }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(request);
    await expect(result.json()).resolves.toMatchInlineSnapshot(`
      {
        data: {
          product: {
            id: 1,
          },
          users: [
            {
              id: 2,
              name: test,
            },
          ],
        },
      }
    `);
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await pollFor(async () => {
      const operationsStatsResult = await readOperationsStats(
        { byId: target.id },
        period,
        {},
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());
      const stats = await readSchemaCoordinateStats('Query.product', period);

      return (
        stats.target?.schemaCoordinateStats.totalResolutions === 1 &&
        stats.target?.schemaCoordinateStats.totalRequests === 1 &&
        stats.target?.schemaCoordinateStats.totalFailures === 0 &&
        operationsStatsResult.target?.operationsStats.operations.edges[0].node.count === 1
      );
    });
  });

  /**
   * The unifiedGraphHandler parses and generates the query plan earlier in this flow. The document
   * passed to the subgraph is then already determined ahead of time. To support rust, it's necessary
   * to either address the root cause and somehow modify the document prior to planning, or
   * to add the hive typenames on subgraph execute every time.
   */
  test.skipIf(gatewayType === 'rust')('supports abstract type', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          interface Product {
            id: ID!
            price: Int
          }

          type GoodieBag implements Product @key(fields: "id") {
            id: ID!
            price: Int
            contents: String
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return {
                __typename: 'GoodieBag',
                id: 1,
                price: 20.2,
              };
            },
          },
        },
      },
    };

    const { readSchemaCoordinateStats, gateway, waitForRequestsCollected } = await setup(
      subgraphs,
      gatewayType,
    );

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            product {
              id
            }
          }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(request);
    await expect(result.json()).resolves.toEqual(
      expect.objectContaining({
        data: {
          product: {
            id: '1',
          },
        },
      }),
    );
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    // @note the rust gateway doesn't track the implemented type: "GoodieBag" here.
    await pollFor(async () => {
      const productStats = await readSchemaCoordinateStats('Product', period);
      const goodieStats = await readSchemaCoordinateStats('GoodieBag', period);
      const productRes = productStats.target?.schemaCoordinateStats.totalResolutions;
      const goodieRes = goodieStats.target?.schemaCoordinateStats.totalResolutions;

      const success = productRes === 1 && goodieRes === 1;
      if (!success) {
        console.warn(`"Product" resolutions: ${productRes}\n"GoodieBag" resolutions: ${goodieRes}`);
      }
      return success;
    });
  });

  test('field-level usage reporting should not result in unrequested __typename included in the client response', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          interface Product {
            id: ID!
          }

          type GoodieBag implements Product @key(fields: "id") {
            id: ID!
          }
        `),
        resolvers: {
          Query: {
            product: () => ({ __typename: 'GoodieBag', id: 1 }),
          },
        },
      },
    };
    const { gateway, waitForRequestsCollected } = await setup(subgraphs, gatewayType);
    const query = /* GraphQL */ `
      {
        product {
          id
        }
      }
    `;

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(
      new Request('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ query }),
      }),
    );

    const response = await result.json();
    await usageCollected;
    expect(response).toEqual({
      data: {
        product: {
          id: '1',
        },
      },
    });
  });

  test.skipIf(gatewayType === 'rust')('errors are tracked', async () => {
    const thrownErrorCode = 'OOPSIE';
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            price: Int
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return { id: 1, price: 20.2 };
            },
          },
        },
      },
      users: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            users: [User]
          }
          type User {
            id: ID!
            name: String
          }
        `),
        resolvers: {
          Query: {
            users: () => [{ id: 2 }],
          },
          User: {
            name: () => {
              throw new GraphQLError('Something went wrong', {
                extensions: {
                  code: thrownErrorCode,
                },
              });
            },
          },
        },
      },
    };

    const {
      readSchemaCoordinateStats,
      readErrorCodes,
      target,
      gateway,
      token,
      waitForRequestsCollected,
    } = await setup(subgraphs, gatewayType);

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            product {
              id
            }
            users {
              id
              name
            }
          }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(request);

    // @note that the rust gateway returns the error path as ["users"].
    await expect(result.json()).resolves.toMatchInlineSnapshot(`
      {
        data: {
          product: {
            id: 1,
          },
          users: [
            {
              id: 2,
              name: null,
            },
          ],
        },
        errors: [
          {
            extensions: {
              code: OOPSIE,
              serviceName: users,
            },
            message: Something went wrong,
            path: [
              users,
              0,
              name,
            ],
          },
        ],
      }
    `);
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await pollFor(async () => {
      const operationsStatsResult = await readOperationsStats(
        { byId: target.id },
        period,
        {},
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());
      const stats = await readSchemaCoordinateStats('Query.product', period);
      const errorCodes = await readErrorCodes('User.name', period);
      const code = errorCodes.target?.schemaCoordinateStats?.errorCodes?.edges?.[0]?.node?.code;

      return (
        code === thrownErrorCode &&
        stats.target?.schemaCoordinateStats.totalResolutions === 1 &&
        stats.target?.schemaCoordinateStats.totalRequests === 1 &&
        stats.target?.schemaCoordinateStats.totalFailures === 0 &&
        operationsStatsResult.target?.operationsStats.operations.edges[0].node.count === 1
      );
    });

    await pollFor(async () => {
      const operationsStatsResult = await readOperationsStats(
        { byId: target.id },
        period,
        {},
        token.secret,
      ).then(r => r.expectNoGraphQLErrors());
      const stats = await readSchemaCoordinateStats('User.name', period);

      return (
        stats.target?.schemaCoordinateStats.totalResolutions === 1 &&
        stats.target?.schemaCoordinateStats.totalRequests === 1 &&
        stats.target?.schemaCoordinateStats.totalFailures === 1 &&
        operationsStatsResult.target?.operationsStats.operations.edges[0].node.count === 1
      );
    });
  });

  test('errors thrown in the gateway are tracked', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            price: Int
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return { id: 1, price: 20.2 };
            },
          },
        },
      },
      users: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            users: [User]
          }
          type User {
            id: ID!
            name: String
          }
        `),
        resolvers: {
          Query: {
            users: () => [{ id: 2 }],
          },
          User: {
            name: () => {
              'j';
            },
          },
        },
      },
    };

    let typeInfo: TypeInfo | undefined;
    const { readErrorCodes, gateway, waitForRequestsCollected } = await setup(
      subgraphs,
      gatewayType,
      [
        {
          onSchemaChange({ schema }) {
            typeInfo = new TypeInfo(schema);
          },
          async onExecute({ args, setResultAndStopExecution }) {
            setResultAndStopExecution({
              data: null,
              errors: [
                new GraphQLError('oops', {
                  extensions: { code: 'NOPE' },
                  path: ['product'],
                }),
              ],
            });
          },
        },
      ],
    );

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          { product { id } }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    await gateway.handle(request);
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await pollFor(async () => {
      const errorCodes = await readErrorCodes('Query.product', period);
      const code = errorCodes.target?.schemaCoordinateStats?.errorCodes?.edges?.[0]?.node?.code;

      return code === 'NOPE';
    });
  });

  test('errors with special characters are tracked', async () => {
    const thrownErrorCode = 'OOPS\"IE';
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            product: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            price: Int
          }
        `),
        resolvers: {
          Query: {
            product: () => {
              return { id: 1, price: 20.2 };
            },
          },
        },
      },
      users: {
        typeDefs: parse(/* GraphQL */ `
          extend type Query {
            users: [User]
          }
          type User {
            id: ID!
            name: String
          }
        `),
        resolvers: {
          Query: {
            users: () => [{ id: 2 }],
          },
          User: {
            name: () => {
              throw new GraphQLError('Something went wrong', {
                extensions: {
                  code: thrownErrorCode,
                },
              });
            },
          },
        },
      },
    };

    const { readErrorCodes, gateway, waitForRequestsCollected } = await setup(
      subgraphs,
      gatewayType,
    );

    const request = new Request('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'x-graphql-client-name': 'app-name',
        'x-graphql-client-version': 'app-version',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        query: `
          {
            product {
              id
            }
            users {
              id
              name
            }
          }
        `,
      }),
    });

    const usageCollected = waitForRequestsCollected(1);
    await gateway.handle(request);
    await usageCollected;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await pollFor(async () => {
      const errorCodes = await readErrorCodes('User.name', period);
      const code = errorCodes.target?.schemaCoordinateStats?.errorCodes?.edges?.[0]?.node?.code;

      return code === thrownErrorCode;
    });
  });

  test('supports named root types', async () => {
    const subgraphs = {
      products: {
        typeDefs: parse(/* GraphQL */ `
          schema {
            query: RootQuery
          }
          type RootQuery {
            product: Product
          }

          interface Product {
            id: ID!
          }

          type GoodieBag implements Product @key(fields: "id") {
            id: ID!
          }
        `),
        resolvers: {
          RootQuery: {
            product: () => ({ __typename: 'GoodieBag', id: 1 }),
          },
        },
      },
    };
    const { gateway, waitForRequestsCollected, readSchemaCoordinateStats } = await setup(
      subgraphs,
      gatewayType,
    );
    const query = /* GraphQL */ `
      {
        product {
          id
        }
      }
    `;

    const usageCollected = waitForRequestsCollected(1);
    const result = await gateway.handle(
      new Request('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ query }),
      }),
    );

    const response = await result.json();
    await usageCollected;
    expect(response).toEqual({
      data: {
        product: {
          id: '1',
        },
      },
    });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const period = {
      from: yesterday.toISOString(),
      to: new Date().toISOString(),
    };

    await waitForExpectations(async () => {
      const stats = await readSchemaCoordinateStats('Query.product', period);
      expect(stats.target?.schemaCoordinateStats.totalResolutions).toBe(1);
      expect(stats.target?.schemaCoordinateStats.totalRequests).toBe(1);
      expect(stats.target?.schemaCoordinateStats.totalFailures).toBe(0);
    });

    const subgraphStats = await readSchemaCoordinateStats('RootQuery.product', period);
    expect(subgraphStats.target?.schemaCoordinateStats.totalResolutions).toBe(0);
  });
});
