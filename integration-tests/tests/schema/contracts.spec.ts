import type { SchemaBuilderApi } from '@hive/schema';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

const host = process.env['SCHEMA_SERVICE_HOST_OVERRIDE'] || 'http://localhost:3002';

const client = createTRPCProxyClient<SchemaBuilderApi>({
  links: [
    httpLink({
      url: host + `/trpc`,
      fetch,
    }),
  ],
});

describe('schema service can process contracts', () => {
  test('single', async () => {
    const result = await client.composeAndValidate.mutate({
      type: 'federation',
      native: true,
      schemas: [
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              hello: String
              helloHidden: String @tag(name: "toyota")
            }
          `,
          source: 'foo.graphql',
          url: null,
        },
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              bar: String
              barHidden: String @tag(name: "toyota")
            }
          `,
          source: 'bar.graphql',
          url: null,
        },
      ],
      external: null,
      contracts: [
        {
          id: 'foo',
          filter: {
            include: null,
            exclude: ['toyota'],
            removeUnreachableTypesFromPublicApiSchema: false,
          },
        },
      ],
    });

    expect(result.contracts?.[0].sdl).toMatchInlineSnapshot(`
      type Query {
        bar: String
        hello: String
      }
  `);
  });

  test('multiple', async () => {
    const result = await client.composeAndValidate.mutate({
      type: 'federation',
      native: true,
      schemas: [
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              hello: String
              helloHidden: String @tag(name: "toyota")
            }
          `,
          source: 'foo.graphql',
          url: null,
        },
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              bar: String
              barHidden: String @tag(name: "toyota")
            }
          `,
          source: 'bar.graphql',
          url: null,
        },
      ],
      external: null,
      contracts: [
        {
          id: 'foo',
          filter: {
            include: null,
            exclude: ['toyota'],
            removeUnreachableTypesFromPublicApiSchema: false,
          },
        },
        {
          id: 'bar',
          filter: {
            include: ['toyota'],
            exclude: null,
            removeUnreachableTypesFromPublicApiSchema: false,
          },
        },
      ],
    });

    expect(result.contracts?.[0].sdl).toMatchInlineSnapshot(`
      type Query {
        bar: String
        hello: String
      }
    `);
    expect(result.contracts?.[1].sdl).toMatchInlineSnapshot(`
      type Query {
        barHidden: String
        helloHidden: String
      }
    `);
  });

  test('remove unreachable types from public schema', async () => {
    const result = await client.composeAndValidate.mutate({
      type: 'federation',
      native: true,
      schemas: [
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              hello: String
              helloHidden: Toyota @tag(name: "toyota")
            }

            type Toyota {
              id: String!
            }
          `,
          source: 'foo.graphql',
          url: null,
        },
      ],
      external: null,
      contracts: [
        {
          id: 'foo',
          filter: {
            include: null,
            exclude: ['toyota'],
            removeUnreachableTypesFromPublicApiSchema: true,
          },
        },
      ],
    });

    expect(result.contracts?.[0].sdl).toMatchInlineSnapshot(`
      type Query {
        hello: String
      }
    `);
  });

  test('keep unreachable types from public schema', async () => {
    const result = await client.composeAndValidate.mutate({
      type: 'federation',
      native: true,
      schemas: [
        {
          raw: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])
            type Query {
              hello: String
              helloHidden: Toyota @tag(name: "toyota")
            }
            type Toyota {
              id: String!
            }
          `,
          source: 'foo.graphql',
          url: null,
        },
      ],
      external: null,
      contracts: [
        {
          id: 'foo',
          filter: {
            include: null,
            exclude: ['toyota'],
            removeUnreachableTypesFromPublicApiSchema: false,
          },
        },
      ],
    });

    expect(result.contracts?.[0].sdl).toMatchInlineSnapshot(`
      type Query {
        hello: String
      }

      type Toyota {
        id: String!
      }
    `);
  });
});

test('federation schema contains list of tags', async () => {
  const result = await client.composeAndValidate.mutate({
    type: 'federation',
    native: true,
    schemas: [
      {
        raw: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
            helloHidden: String @tag(name: "toyota") @tag(name: "turtle")
          }
        `,
        source: 'foo.graphql',
        url: null,
      },
    ],
    external: null,
    contracts: [
      {
        id: 'foo',
        filter: {
          include: null,
          exclude: ['toyota'],
          removeUnreachableTypesFromPublicApiSchema: false,
        },
      },
    ],
  });

  expect(result.tags).toMatchInlineSnapshot(`
    [
      toyota,
      turtle,
    ]
  `);
});
