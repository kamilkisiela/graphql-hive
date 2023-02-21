import { parse } from 'graphql';
import { composeAndValidate } from '@apollo/federation';

test('patch', () => {
  const result = composeAndValidate([
    {
      typeDefs: parse(/* GraphQL */ `
        extend type Review @key(fields: "id") {
          id: String! @external
          title: String! @external
        }

        type Product @key(fields: "id") {
          id: ID!
          name: String!
          properties: Properties
          reviews: [Review] @provides(fields: "id")
        }

        type Properties {
          available: Boolean
        }

        type Query {
          randomProduct: Product
        }
      `),
      name: 'foo',
    },
    {
      typeDefs: parse(/* GraphQL */ `
        type Query {
          bar: Bar
        }

        type Bar {
          id: ID!
          name: String!
        }
      `),
      name: 'bar',
    },
  ]);

  expect(result.errors!.map(e => e.message)).not.toContainEqual(
    expect.stringMatching('Unknown type "Bar"'),
  );
  expect(result.errors!.map(e => e.message)).not.toContainEqual(
    expect.stringMatching('Unknown type "Product"'),
  );
  expect(result.errors!.map(e => e.message)).toContainEqual(
    expect.stringMatching('Unknown type "Review"'),
  );
});
