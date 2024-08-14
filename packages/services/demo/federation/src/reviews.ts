import { parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { buildSubgraphSchema } from '@apollo/subgraph';

const usernames = [
  { id: '1', username: '@ada' },
  { id: '2', username: '@complete' },
];

const reviews = [
  {
    id: '1',
    authorID: '1',
    product: { upc: '1' },
    body: 'Love it!',
  },
  {
    id: '2',
    authorID: '1',
    product: { upc: '2' },
    body: 'Too expensive.',
  },
  {
    id: '3',
    authorID: '2',
    product: { upc: '3' },
    body: 'Could be better.',
  },
  {
    id: '4',
    authorID: '2',
    product: { upc: '1' },
    body: 'Prefer something else.',
  },
];

type Review = (typeof reviews)[number];
type User = (typeof usernames)[number];
type Context = {
  reviews: Review[];
  usernames: User[];
};

const typeDefs = parse(/* GraphQL */ `
  type Review @key(fields: "id") {
    id: ID!
    body: String
    author: User @provides(fields: "username")
    product: Product
  }

  extend type User @key(fields: "id") {
    id: ID! @external
    username: String @external
    reviews: [Review]
  }

  extend type Product @key(fields: "upc") {
    upc: String! @external
    reviews: [Review]
  }
`);

const resolvers = {
  Review: {
    __resolveReference(review: Review, context: Context) {
      return {
        ...review,
        ...context.reviews.find(r => r.id === review.id),
      };
    },
    author(review: Review) {
      return { __typename: 'User', id: review.authorID };
    },
  },
  User: {
    __resolveReference(user: User, context: Context) {
      return { ...user, ...context.usernames.find(u => u.id === user.id) };
    },
    reviews(user: User, _: unknown, context: Context) {
      return context.reviews.filter(review => review.authorID === user.id);
    },
    numberOfReviews(user: User) {
      return reviews.filter(review => review.authorID === user.id).length;
    },
    username(user: User) {
      const found = usernames.find(username => username.id === user.id);
      return found ? found.username : null;
    },
  },
  Product: {
    reviews(product: { upc: string }, context: Context) {
      return context.reviews.filter(review => review.product.upc === product.upc);
    },
  },
};

export const yoga = createYoga<Context>({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  context() {
    return { reviews, usernames };
  },
  landingPage: false,
  graphqlEndpoint: '/reviews',
  graphiql: {
    title: 'Reviews Subgraph',
  },
});
