import { ProjectType, RegistryModel } from '@app/gql/graphql';
import { createCLI } from '../../testkit/cli';
import { prepareProject } from '../../testkit/registry-models';

describe('publish', () => {
  test.concurrent('accepted: composable', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });
  });

  test.concurrent('rejected: composable, breaking changes', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'rejected',
    });
  });

  test.concurrent('partially accepted: composable, breaking changes (force)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      legacy_force: true,
      expect: 'latest',
    });
  });

  test.concurrent('accepted: composable, breaking changes (acceptBreakingChanges)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
      legacy_acceptBreakingChanges: true,
    });
  });

  test.concurrent('accepted: composable, previous version was not', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    // non-composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product {
          id: ID!
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest',
      legacy_force: true,
    });

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product {
          id: ID!
          name: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });
  });

  test.concurrent('accepted (ignored): composable, no changes', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    // composable but no changes
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'ignored',
    });
  });

  test.concurrent('accepted: composable, new url', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    // composable, no changes, only url is different
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:4321/graphql', // new url
      expect: 'latest-composable',
    });
  });

  test.concurrent('rejected: missing service name', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceUrl: 'http://products:3000/graphql',
      expect: 'rejected',
    });
  });

  test.concurrent('accepted: missing service url', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      expect: 'latest-composable',
    });
  });

  test.concurrent('CLI output', async ({ expect }) => {
    const { publish } = await prepare();

    const service = {
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
    };

    await expect(
      publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product {
            id: ID!
            name: String!
          }
        `,
        ...service,
        expect: 'latest-composable',
      }),
    ).resolves.toMatchInlineSnapshot(`
      v Published initial schema.
      i Available at http://localhost:8080/$organization/$project/production
    `);

    await expect(
      publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product {
            id: ID!
            name: String!
            price: Int!
          }
        `,
        ...service,
        expect: 'latest-composable',
      }),
    ).resolves.toMatchInlineSnapshot(`
      i Detected 1 change
      - Field price was added to object type Product
      v Schema published
      i Available at http://localhost:8080/$organization/$project/production/history/$version
    `);
  });
});

describe('check', () => {
  test.concurrent('accepted: composable, no breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
          topProductName: String
        }
      `,
      serviceName: 'products',
      expect: 'approved',
    });

    expect(message).toMatch('topProductName');
  });

  test.concurrent('accepted: composable, previous version was not', async () => {
    const { publish, check } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    // non-composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product {
          id: ID!
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest',
      legacy_force: true,
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }

        type Product {
          id: ID!
          age: Int
        }
      `,
      serviceName: 'products',
      expect: 'approved',
    });

    expect(message).toMatch('age');
  });

  test.concurrent('accepted: no changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      expect: 'approved',
    });
  });

  test.concurrent('rejected: missing service name', async () => {
    const { check, publish } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
          product(id: ID!): String
        }
      `,
      expect: 'rejected',
    });

    expect(message).toMatch('name');
  });

  test.concurrent('rejected: composable, breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      serviceName: 'products',
      expect: 'rejected',
    });

    expect(message).toMatch('removed');
  });

  test.concurrent('rejected: not composable, no breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
          topProductName: Strin
        }
      `,
      serviceName: 'products',
      expect: 'rejected',
    });

    expect(message).toMatch('Str');
  });

  test.concurrent('rejected: not composable, breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product @key(selectionSet: "{ id }") {
          id: ID!
          name: String
        }
      `,
      serviceName: 'products',
      serviceUrl: 'http://products:3000/graphql',
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          product(id: ID!): Product
        }
        type Product @key(selectionSet: "{ id }") {
          id: ID!
          name: String
        }
      `,
      serviceName: 'products',
      expect: 'rejected',
    });

    expect(message).toMatch('topProduct');
  });
});

describe('delete', () => {
  describe('delete', () => {
    test.concurrent('reject and ask to upgrade', async () => {
      const cli = await prepare();

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product @key(selectionSet: "{ id }") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        expect: 'latest-composable',
      });

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topReview: Review
          }

          type Review @key(selectionSet: "{ id }") {
            id: ID!
            title: String
          }
        `,
        serviceName: 'reviews',
        serviceUrl: 'http://reviews:3000/graphql',
        expect: 'latest-composable',
      });

      const message = await cli.delete({
        serviceName: 'reviews',
        expect: 'rejected',
      });

      expect(message).toMatch(/upgrade your project/);
    });
  });
});

async function prepare() {
  const { tokens } = await prepareProject(ProjectType.Stitching, RegistryModel.Legacy);

  return createCLI(tokens.registry);
}
