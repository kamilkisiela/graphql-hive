import { parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { buildSubgraphSchema } from '@apollo/subgraph';

const products = [
  {
    upc: '1',
    name: 'Table',
    price: 899,
    weight: 100,
  },
  {
    upc: '2',
    name: 'Couch',
    price: 1299,
    weight: 1000,
  },
  {
    upc: '3',
    name: 'Chair',
    price: 54,
    weight: 50,
  },
];

type Product = (typeof products)[number];
type Context = {
  products: Product[];
};

const typeDefs = parse(/* GraphQL */ `
  extend type Query {
    topProducts(first: Int = 5): [Product]
  }

  type Product @key(fields: "upc") {
    upc: String!
    name: String
    price: Int
    weight: Int
  }
`);

const resolvers = {
  Product: {
    __resolveReference(object: Product, context: Context) {
      return {
        ...object,
        ...context.products.find(product => product.upc === object.upc),
      };
    },
  },
  Query: {
    topProducts(_: unknown, args: { first: number }, context: Context) {
      return context.products.slice(0, args.first);
    },
  },
};

export const yoga = createYoga<Context>({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  context() {
    return { products };
  },
  landingPage: false,
  graphqlEndpoint: '/products',
  graphiql: {
    title: 'Products Subgraph',
  },
});
