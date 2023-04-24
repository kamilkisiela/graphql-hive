import { gql } from 'graphql-modules';

export default gql`
  directive @defer on FRAGMENT_SPREAD | INLINE_FRAGMENT

  scalar DateTime
  scalar JSON
  scalar SafeInt

  type Query {
    noop: Boolean
  }

  type Mutation {
    noop: Boolean
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String!
    endCursor: String!
  }
`;
