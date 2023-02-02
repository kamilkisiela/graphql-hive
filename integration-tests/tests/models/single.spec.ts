import { ProjectType } from '@app/gql/graphql';
import { createCLI } from '../../testkit/cli';
import { prepareProject } from '../../testkit/registry-models';

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

  test.concurrent('rejected: not composable (graphql errors)', async () => {
    const { publish } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
      `,
      expect: 'rejected',
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

    expect(message).toMatch('Str');
  });
});

describe('delete', () => {
  test.concurrent('not supported', async () => {
    const cli = await prepare();

    await cli.delete({
      serviceName: 'test',
      expect: 'rejected',
    });
  });
});

async function prepare() {
  const { tokens } = await prepareProject(ProjectType.Single);

  return createCLI(tokens.registry);
}
