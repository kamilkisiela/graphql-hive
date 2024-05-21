import { gql } from 'graphql-modules';

export default gql`
  scalar DateTime
  scalar Date
  scalar JSON
  scalar JSONSchemaObject
  scalar SafeInt
  scalar UUID

  type Query {
    noop: Boolean
  }

  type Mutation {
    noop(noop: String): Boolean
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String!
    endCursor: String!
  }
`;
