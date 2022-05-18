import { gql } from 'graphql-modules';

export default gql`
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
    hasMore: Boolean!
  }
`;
