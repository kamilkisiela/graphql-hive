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
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
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
      `${caseName === 'default' ? 'rejected' : 'accepted'}: not composable (build errors)`,
      async () => {
        const {
          cli: { publish },
        } = await prepare(ffs);
        await publish({
          sdl: /* GraphQL */ `
            type Query {
              topProductName: UnknownType
            }
          `,
          serviceName: 'products',
          serviceUrl: 'http://products:3000/graphql',
          expect: caseName === 'default' ? 'rejected' : 'latest',
        });
      },
    );

    test.concurrent('accepted: composable, previous version was not', async () => {
      const {
        cli: { publish },
      } = await prepare(ffs);

      // non-composable
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            product(id: ID!): Product
          }

          type Product @key(selectionSet: "{ id") {
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

          type Product @key(selectionSet: "{ id }") {
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
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        metadata: { products: 3000 },
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
        metadata: { products: 3000 },
        expect: 'ignored',
      });
    });

    test.concurrent('accepted: composable, new url', async () => {
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

    test.concurrent('accepted: composable, new metadata', async () => {
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
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        metadata: { version: 'v1' },
        expect: 'latest-composable',
      });

      // composable, no changes, only metadata is different
      await publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: String
          }
        `,
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
        metadata: { version: 'v2' }, // new metadata
        expect: 'latest-composable',
      });
    });

    test.concurrent('rejected: missing service name', async () => {
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
        serviceUrl: 'http://products:3000/graphql',
        expect: 'rejected',
      });
    });

    test.concurrent('rejected: missing service url', async () => {
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
        serviceName: 'products',
        expect: 'rejected',
      });
    });

    test.concurrent('CLI output', async ({ expect }) => {
      const {
        cli: { publish },
      } = await prepare(ffs);

      const service = {
        serviceName: 'products',
        serviceUrl: 'http://products:3000/graphql',
      };

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
          ...service,
          expect: 'latest-composable',
        })) ?? '',
      );

      expect(output).toEqual(expect.stringContaining('v Published initial schema.'));
      expect(output).toEqual(
        expect.stringContaining(
          'i Available at http://localhost:8080/$organization/$project/production',
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
          ...service,
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

  describe('check', () => {
    describe.concurrent.each(cases)('%s', (caseName, ffs) => {
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
        const {
          cli: { publish, check },
        } = await prepare(ffs);

        await publish({
          sdl: /* GraphQL */ `
            type Query {
              product(id: ID!): Product
            }

            type Product @key(selectionSet: "{ id") {
              id: ID!
              name: String
            }
          `,
          serviceName: 'products',
          serviceUrl: 'http://products:3000/graphql',
          expect: 'latest',
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
          expect: 'approved',
        });

        expect(message).toMatch('No changes');
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
        const {
          cli: { check },
        } = await prepare(ffs);

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
        const {
          cli: { publish, check },
        } = await prepare(ffs);

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
        const {
          cli: { publish, check },
        } = await prepare(ffs);

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
        const {
          cli: { publish, check },
        } = await prepare(ffs);

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

            type Product @key(selectionSet: "{ id") {
              id: ID!
              name: String
            }
          `,
          serviceName: 'products',
          expect: 'rejected',
        });

        expect(message).toMatch('topProduct');
        expect(message).toMatch('Expected Name');
      });
    });
  });
});

describe('delete', () => {
  describe.concurrent.each(cases)('%s', (caseName, ffs) => {
    test.concurrent('accepted: composable before and after', async () => {
      const { cli } = await prepare(ffs);

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
        expect: 'latest-composable',
      });

      expect(message).toMatch('reviews deleted');
    });

    test.concurrent('rejected: unknown service', async () => {
      const { cli } = await prepare(ffs);

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

      const message = await cli.delete({
        serviceName: 'unknown_service',
        expect: 'rejected',
      });

      expect(message).toMatch('not found');
    });
  });
});

describe('other', () => {
  describe.concurrent.each(cases)('%s', (_, ffs) => {
    test.concurrent(
      'publish new schema when a field is moved from one service to another',
      async () => {
        const { tokens, fetchVersions, setFeatureFlag } = await prepareProject(
          ProjectType.Stitching,
        );

        for await (const [name, enabled] of ffs) {
          await setFeatureFlag(name, enabled);
        }

        const { publish } = createCLI(tokens.registry);

        // cats service has only one field
        await publish({
          sdl: /* GraphQL */ `
            type Query {
              randomCat: String
            }
          `,
          serviceName: 'cats',
          serviceUrl: 'http://cats.com/graphql',
          expect: 'latest-composable',
        });

        // dogs service has two fields
        await publish({
          sdl: /* GraphQL */ `
            type Query {
              randomDog: String
              randomAnimal: String
            }
          `,
          serviceName: 'dogs',
          serviceUrl: 'http://dogs.com/graphql',
          expect: 'latest-composable',
        });

        // cats service has now two fields, randomAnimal is borrowed from dogs service
        await publish({
          sdl: /* GraphQL */ `
            type Query {
              randomCat: String
              randomAnimal: String
            }
          `,
          serviceName: 'cats',
          serviceUrl: 'http://cats.com/graphql',
          expect: 'latest-composable', // We expect to have a new version, even tough the schema (merged) is the same
        });

        const versionsResult = await fetchVersions(3);
        expect(versionsResult).toHaveLength(3);
      },
    );

    test.concurrent(
      'ignore stitching directive validation if the service overrides the stitching directive',
      async () => {
        const [spec, custom] = await Promise.all([prepare(ffs), prepare(ffs)]);

        // Make sure validation works by publishing a schema
        // with a stitching directive with incomplete selectionSet argument
        await spec.cli.publish({
          sdl: /* GraphQL */ `
            type Query {
              topProduct: Product
            }

            type Product @key(selectionSet: "{ id ") {
              id: ID!
              name: String
            }
          `,
          serviceName: 'products',
          serviceUrl: 'http://products:3000/graphql',
          expect: 'latest', // it's not composable because of the invalid selectionSet
        });

        // Stitching directive with incomplete selectionSet argument but a definition of @key
        await custom.cli.publish({
          sdl: /* GraphQL */ `
            directive @key(selectionSet: String) on OBJECT

            type Query {
              topProduct: Product
            }

            type Product @key(selectionSet: "{ id ") {
              id: ID!
              name: String
            }
          `,
          serviceName: 'products',
          serviceUrl: 'http://products:3000/graphql',
          expect: 'latest-composable', // it should be composable because the validation is skipped
        });
      },
    );

    test.concurrent('metadata should always be published as an array', async () => {
      const { cli, cdn } = await prepare(ffs);

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
        metadata: { products: 'v1' },
        expect: 'latest-composable',
      });

      await expect(cdn.fetchMetadata()).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          body: [{ products: 'v1' }], // array
        }),
      );

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
        metadata: { reviews: 'v1' },
        expect: 'latest-composable',
      });

      await expect(cdn.fetchMetadata()).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          body: [{ products: 'v1' }, { reviews: 'v1' }], // array
        }),
      );

      await cli.delete({
        serviceName: 'reviews',
        expect: 'latest-composable',
      });

      await expect(cdn.fetchMetadata()).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          body: [{ products: 'v1' }], // array
        }),
      );
    });
  });
});

async function prepare(featureFlags: Array<[string, boolean]> = []) {
  const { tokens, setFeatureFlag, cdn } = await prepareProject(ProjectType.Stitching);

  for await (const [name, enabled] of featureFlags) {
    await setFeatureFlag(name, enabled);
  }

  return {
    cli: createCLI(tokens.registry),
    cdn,
  };
}
