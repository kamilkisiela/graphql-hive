import { ProjectType } from '@app/gql/graphql';
import { createCLI } from '../../testkit/cli';
import { prepareProject } from '../../testkit/registry-models';

const cases = [
  ['default' as const, [] as [string, boolean][]],
  [
    'compareToPreviousComposableVersion' as const,
    [['compareToPreviousComposableVersion', true]] as [string, boolean][],
  ],
] as Array<['default' | 'compareToPreviousComposableVersion', Array<[string, boolean]>]>;

describe('publish', () => {
  describe.each(cases)('%s', (caseName, ffs) => {
    test.concurrent('accepted: composable', async () => {
      const { publish } = await prepare(ffs);
      await publish({
        sdl: `type Query { topProductName: String }`,
        expect: 'latest-composable',
      });
    });

    test.concurrent('accepted: composable, breaking changes', async () => {
      const { publish } = await prepare(ffs);
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProductName: String
          }
        `,
        expect: 'latest-composable',
      });

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            nooooo: String
          }
        `,
        expect: 'latest-composable',
      });
    });

    test.concurrent(
      `${caseName === 'default' ? 'rejected' : 'accepted'}: not composable (graphql errors)`,
      async () => {
        const { publish } = await prepare(ffs);

        await publish({
          sdl: /* GraphQL */ `
            type Query {
              topProduct: Product
            }
          `,
          expect: caseName === 'default' ? 'rejected' : 'latest',
        });
      },
    );

    test.concurrent('accepted: composable, no changes', async () => {
      const { publish } = await prepare(ffs);

      // composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'latest-composable',
      });

      // composable but no changes
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'ignored',
      });
    });

    test.concurrent('CLI output', async ({ expect }) => {
      const { publish } = await prepare(ffs);

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
          expect: 'latest-composable',
        }),
      ).resolves.toMatchInlineSnapshot(`
      v Schema published
      i Available at http://localhost:8080/$organization/$project/production/history/$version
    `);
    });
  });
});

describe('check', () => {
  describe.each(cases)('%s', (_, ffs) => {
    test.concurrent('accepted: composable, no breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'latest-composable',
      });

      const message = await check({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
            topProductName: String
          }
        `,
        expect: 'approved',
      });

      expect(message).toMatch('topProductName');
    });

    test.concurrent('accepted: no changes', async () => {
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'latest-composable',
      });

      await check({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'approved',
      });
    });

    test.concurrent('rejected: composable, breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'latest-composable',
      });

      const message = await check({
        sdl: /* GraphQL */ `
          type Query {
            topProductName: String
          }
        `,
        expect: 'rejected',
      });

      expect(message).toMatch('removed');
    });

    test.concurrent('rejected: not composable, no breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'latest-composable',
      });

      const message = await check({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
            topProductName: Strin
          }
        `,
        expect: 'rejected',
      });

      expect(message).toMatch('Strin');
    });

    test.concurrent('rejected: not composable, breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

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
        expect: 'latest-composable',
      });

      const message = await check({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
          }

          type Product {
            id: ID!
            name: Str
          }
        `,
        expect: 'rejected',
      });

      expect(message).toMatch('Str');
    });
  });
});

describe('delete', () => {
  describe.each(cases)('%s', (_, ffs) => {
    test.concurrent('not supported', async () => {
      const cli = await prepare(ffs);

      await cli.delete({
        serviceName: 'test',
        expect: 'rejected',
      });
    });
  });
});

async function prepare(featureFlags: Array<[string, boolean]> = []) {
  const { tokens, setFeatureFlag } = await prepareProject(ProjectType.Single);

  for await (const [name, enabled] of featureFlags) {
    await setFeatureFlag(name, enabled);
  }

  return createCLI(tokens.registry);
}
