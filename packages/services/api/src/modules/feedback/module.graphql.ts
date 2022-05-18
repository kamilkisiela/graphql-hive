import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    sendFeedback(feedback: String!): Boolean!
  }
`;
