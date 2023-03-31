import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { createCLI, schemaPublish } from '../../testkit/cli';
import { prepareProject } from '../../testkit/registry-models';
import { initSeed } from '../../testkit/seed';

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
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
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
      });
    });

    test.concurrent(
      `${caseName === 'default' ? 'rejected' : 'accepted'}: not composable (graphql errors)`,
      async () => {
        const { publish } = await prepare(ffs);

        // non-composable
        await publish({
          sdl: /* GraphQL */ `
            type Query {
              topProduct: Product
            }
          `,
          serviceName: 'products',
          serviceUrl: 'http://products:3000/graphql',
          expect: caseName === 'default' ? 'rejected' : 'latest',
        });
      },
    );

    test.concurrent('accepted: composable, previous version was not', async () => {
      const { publish } = await prepare(ffs);

      // non-composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
          }
          type Product @key(fields: "it") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        expect: 'latest',
      });

      // composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
          }
          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        expect: 'latest-composable',
      });
    });

    test.concurrent('accepted: composable, no changes', async () => {
      const { publish } = await prepare(ffs);

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
      const { publish } = await prepare(ffs);

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
      const { publish } = await prepare(ffs);

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

    test.concurrent('rejected: missing service url', async () => {
      const { publish } = await prepare(ffs);

      // composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        serviceName: 'products',
        expect: 'rejected',
      });
    });

    test.concurrent('CLI output', async ({ expect }) => {
      const { publish } = await prepare(ffs);

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
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
          }
          type Product @key(fields: "it") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        expect: 'latest',
      });

      await check({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
            topProduct: Product
          }
          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        expect: 'approved',
      });
    });

    test.concurrent('accepted: no changes', async () => {
      const { publish, check } = await prepare(ffs);

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
      const { check } = await prepare(ffs);

      const message = await check({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        expect: 'rejected',
      });

      expect(message).toMatch('name');
    });

    test.concurrent('rejected: composable, breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

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
      const { publish, check } = await prepare(ffs);

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

      expect(message).toMatch('Strin');
    });

    test.concurrent('rejected: not composable, breaking changes', async () => {
      const { publish, check } = await prepare(ffs);

      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product @key(fields: "id") {
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

          type Product @key(fields: "it") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        expect: 'rejected',
      });

      expect(message).toMatch('Product.it');
      expect(message).toMatch('topProduct');
    });
  });
});

describe('delete', () => {
  describe.each(cases)('%s', (_, ffs) => {
    test.concurrent('accepted: composable before and after', async () => {
      const cli = await prepare(ffs);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product @key(fields: "id") {
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

          type Review @key(fields: "id") {
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
        expect: 'latest-composable',
      });

      expect(message).toMatch('reviews deleted');
    });

    test.concurrent('rejected: unknown service', async () => {
      const cli = await prepare(ffs);

      await cli.publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        expect: 'latest-composable',
      });

      const message = await cli.delete({
        serviceName: 'unknown_service',
        expect: 'rejected',
      });

      expect(message).toMatch('not found');
    });
  });
});

describe('other', () => {
  describe.each(cases)('%s', (_, ffs) => {
    test.concurrent('service url should be available in supergraph', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { inviteAndJoinMember, createProject } = await createOrg();
      await inviteAndJoinMember();
      const { createToken } = await createProject(ProjectType.Federation);
      const { secret, fetchSupergraph } = await createToken({});

      await schemaPublish([
        '--token',
        secret,
        '--author',
        'Kamil',
        '--commit',
        'abc123',
        '--service',
        'users',
        '--url',
        'https://api.com/users-subgraph',
        'fixtures/federation-init.graphql',
      ]);

      const supergraph = await fetchSupergraph();
      expect(supergraph).toMatch('(name: "users" url: "https://api.com/users-subgraph")');
    });

    test.concurrent(
      'publishing composable schema without the definition of the Query type, but only extension, should work',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject, setFeatureFlag } = await createOrg();

        for await (const [name, enabled] of ffs) {
          await setFeatureFlag(name, enabled);
        }

        const { createToken } = await createProject(ProjectType.Federation);
        const readWriteToken = await createToken({
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
          projectScopes: [],
          organizationScopes: [],
        });

        await readWriteToken.publishSchema({
          service: 'products',
          author: 'Kamil',
          commit: 'products',
          url: 'https://api.com/products',
          experimental_acceptBreakingChanges: true,
          force: true,
          sdl: /* GraphQL */ `
            type Product @key(fields: "id") {
              id: ID!
              title: String
              url: String
            }

            extend type Query {
              product(id: ID!): Product
            }
          `,
        });

        await readWriteToken.publishSchema({
          service: 'users',
          author: 'Kamil',
          commit: 'users',
          url: 'https://api.com/users',
          experimental_acceptBreakingChanges: true,
          force: true,
          sdl: /* GraphQL */ `
            type User @key(fields: "id") {
              id: ID!
              name: String!
            }

            extend type Query {
              user(id: ID!): User
            }
          `,
        });

        const latestValid = await readWriteToken.fetchLatestValidSchema();
        expect(latestValid.latestValidVersion?.schemas.nodes[0]).toEqual(
          expect.objectContaining({
            commit: 'users',
          }),
        );
      },
    );

    test.concurrent(
      '(experimental_acceptBreakingChanges and force) publishing composable schema on second attempt',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject, setFeatureFlag } = await createOrg();

        for await (const [name, enabled] of ffs) {
          await setFeatureFlag(name, enabled);
        }

        const { createToken } = await createProject(ProjectType.Federation);
        const readWriteToken = await createToken({
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
          projectScopes: [],
          organizationScopes: [],
        });

        await readWriteToken.publishSchema({
          service: 'reviews',
          author: 'Kamil',
          commit: 'reviews',
          url: 'https://api.com/reviews',
          experimental_acceptBreakingChanges: true,
          force: true,
          sdl: /* GraphQL */ `
            extend type Product @key(fields: "id") {
              id: ID! @external
              reviews: [Review]
              reviewSummary: ReviewSummary
            }

            type Review @key(fields: "id") {
              id: ID!
              rating: Float
            }

            type ReviewSummary {
              totalReviews: Int
            }
          `,
        });

        await readWriteToken.publishSchema({
          service: 'products',
          author: 'Kamil',
          commit: 'products',
          url: 'https://api.com/products',
          experimental_acceptBreakingChanges: true,
          force: true,
          sdl: /* GraphQL */ `
            enum CURRENCY_CODE {
              USD
            }

            type Department {
              category: ProductCategory
              url: String
            }

            type Money {
              amount: Float
              currencyCode: CURRENCY_CODE
            }

            type Price {
              cost: Money
              deal: Float
              dealSavings: Money
            }

            type Product @key(fields: "id") {
              id: ID!
              title: String
              url: String
              description: String
              price: Price
              salesRank(category: ProductCategory = ALL): Int
              salesRankOverall: Int
              salesRankInCategory: Int
              category: ProductCategory
              images(size: Int = 1000): [String]
              primaryImage(size: Int = 1000): String
            }

            enum ProductCategory {
              ALL
              GIFT_CARDS
              ELECTRONICS
              CAMERA_N_PHOTO
              VIDEO_GAMES
              BOOKS
              CLOTHING
            }

            extend type Query {
              categories: [Department]
              product(id: ID!): Product
            }
          `,
        });

        const latestValid = await readWriteToken.fetchLatestValidSchema();
        expect(latestValid.latestValidVersion?.schemas.nodes[0]).toEqual(
          expect.objectContaining({
            commit: 'products',
          }),
        );
      },
    );
  });
});

async function prepare(featureFlags: Array<[string, boolean]> = []) {
  const { tokens, setFeatureFlag } = await prepareProject(ProjectType.Federation);

  for await (const [name, enabled] of featureFlags) {
    await setFeatureFlag(name, enabled);
  }

  return createCLI(tokens.registry);
}
