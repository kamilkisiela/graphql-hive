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
          },
        },
        {
          id: 'bar',
          filter: {
            include: ['toyota'],
            exclude: null,
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
});
