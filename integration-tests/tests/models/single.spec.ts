import { ProjectType } from '@app/gql/graphql';
import { normalizeCliOutput } from '../../../scripts/serializers/cli-output';
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
  describe.concurrent.each(cases)('%s', (caseName, ffs) => {
    test.concurrent('accepted: composable', async () => {
      const {
        cli: { publish },
      } = await prepare(ffs);
      await publish({
        sdl: `type Query { topProductName: String }`,
        expect: 'latest-composable',
      });
    });

    test.concurrent('accepted: composable, breaking changes', async () => {
      const {
        cli: { publish },
      } = await prepare(ffs);
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
        const {
          cli: { publish },
        } = await prepare(ffs);

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
      const {
        cli: { publish },
      } = await prepare(ffs);

      // composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        metadata: { version: 'v1' },
        expect: 'latest-composable',
      });

      // composable but no changes
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        metadata: { version: 'v1' },
        expect: 'ignored',
      });
    });

    test.concurrent('accepted: composable, no changes but modified metadata', async () => {
      const {
        cli: { publish },
      } = await prepare(ffs);

      // composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        metadata: { version: 'v1' },
        expect: 'latest-composable',
      });

      // composable but no changes with modified metadata
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        metadata: { version: 'v2' },
        expect: 'latest-composable',
      });
    });

    test.concurrent('CLI output', async ({ expect }) => {
      const {
        cli: { publish },
      } = await prepare(ffs);

      let output = normalizeCliOutput(
        (await publish({
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
        })) ?? '',
      );

      expect(output).toEqual(expect.stringContaining(`v Published initial schema.`));
      expect(output).toEqual(
        expect.stringContaining(
          `i Available at http://localhost:8080/$organization/$project/production`,
        ),
      );

      output = normalizeCliOutput(
        (await publish({
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
        })) ?? '',
      );

      expect(output).toEqual(expect.stringContaining(`v Schema published`));
      expect(output).toEqual(
        expect.stringContaining(
          `i Available at http://localhost:8080/$organization/$project/production/history/$version`,
        ),
      );
    });
  });
});

describe('check', () => {
  describe.concurrent.each(cases)('%s', (_, ffs) => {
    test.concurrent('accepted: composable, no breaking changes', async () => {
      const {
        cli: { publish, check },
      } = await prepare(ffs);

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
      const {
        cli: { publish, check },
      } = await prepare(ffs);

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
      const {
        cli: { publish, check },
      } = await prepare(ffs);

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
      const {
        cli: { publish, check },
      } = await prepare(ffs);

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
      const {
        cli: { publish, check },
      } = await prepare(ffs);

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
  describe.concurrent.each(cases)('%s', (_, ffs) => {
    test.concurrent('not supported', async () => {
      const { cli } = await prepare(ffs);

      await cli.delete({
        serviceName: 'test',
        expect: 'rejected',
      });
    });
  });
});

describe('others', () => {
  describe.concurrent.each(cases)('%s', (_, ffs) => {
    test.concurrent('metadata should always be published as an array', async () => {
      const { cli, cdn } = await prepare(ffs);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        metadata: { version: 'v1' },
        expect: 'latest-composable',
      });

      await expect(cdn.fetchMetadata()).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          body: { version: 'v1' }, // not an array
        }),
      );

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
            topProducts: [String]
          }
        `,
        metadata: { version: 'v2' },
        expect: 'latest-composable',
      });

      await expect(cdn.fetchMetadata()).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          body: { version: 'v2' }, // not an array
        }),
      );
    });
  });
});

async function prepare(featureFlags: Array<[string, boolean]> = []) {
  const { tokens, setFeatureFlag, cdn } = await prepareProject(ProjectType.Single);

  for await (const [name, enabled] of featureFlags) {
    await setFeatureFlag(name, enabled);
  }

  return {
    cli: createCLI(tokens.registry),
    cdn,
  };
}
