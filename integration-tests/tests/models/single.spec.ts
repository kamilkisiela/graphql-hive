import { ProjectType } from '@app/gql/graphql';
import { prepareProject } from '../../testkit/registry-models';
import { createCLI } from '../../testkit/cli';

describe('publish', () => {
  test.concurrent('accepted: composable', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: `type Query { topProductName: String }`,
      expect: 'latest-composable',
    });
  });

  test.concurrent('accepted: composable, breaking changes', async () => {
    const { publish } = await prepare();
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

  test.concurrent('accepted: composable, previous version was not', async () => {
    const { publish } = await prepare();

    // non-composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
      `,
      expect: 'latest',
    });

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product {
          id: ID!
        }
      `,
      expect: 'latest-composable',
    });
  });

  test.concurrent('accepted: composable, no changes', async () => {
    const { publish } = await prepare();

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

  test.concurrent('accepted: composable, previous version was not', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }

        type Product {
          id: UUID!
        }
      `,
      expect: 'latest',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }

        type Product {
          id: ID!
        }
      `,
      expect: 'approved',
    });

    expect(message).toMatch('topProduct');
  });

  test.concurrent('accepted: no changes', async () => {
    const { publish, check } = await prepare();

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
    const { publish, check } = await prepare();

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
    const { publish, check } = await prepare();

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
    const { publish, check } = await prepare();

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

    expect(message).toMatch('Product.name');
    expect(message).toMatch('topProduct');
  });
});

async function prepare() {
  const {
    tokens: { registry: token },
  } = await prepareProject(ProjectType.Single);

  return createCLI(token);
}
