import { parse } from 'graphql';
import { createYoga } from 'graphql-yoga';
import { buildSubgraphSchema } from '@apollo/subgraph';

const typeDefs = parse(/* GraphQL */ `
  extend type Query {
    me: User
    user(id: ID!): User
    users: [User]
  }

  type User @key(fields: "id") {
    id: ID!
    name: String
    username: String
  }
`);

const users = [
  {
    id: '1',
    name: 'Ada Lovelace',
    birthDate: '1815-12-10',
    username: '@ada',
  },
  {
    id: '2',
    name: 'Alan Turing',
    birthDate: '1912-06-23',
    username: '@complete',
  },
];

type User = (typeof users)[number];

type Context = {
  users: User[];
};

const resolvers = {
  User: {
    __resolveReference(user: User, context: Context) {
      return { ...user, ...context.users.find(u => u.id === user.id) };
    },
  },
  Query: {
    me(_source: unknown, _args: unknown, context: Context) {
      return context.users[0];
    },
    users(_source: unknown, _args: unknown, context: Context) {
      return context.users;
    },
    user(_source: unknown, args: { id: string }, context: Context) {
      return context.users.find(user => user.id === args.id);
    },
  },
};

export const yoga = createYoga<Context>({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  context() {
    return { users };
  },
  landingPage: false,
  graphqlEndpoint: '/users',
  graphiql: {
    title: 'Users Subgraph',
  },
});
