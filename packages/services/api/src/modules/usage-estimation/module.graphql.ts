import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    usageEstimation(input: UsageEstimationInput!): UsageEstimation!
  }

  input UsageEstimationInput {
    year: Int!
    month: Int!
    organizationSlug: String!
  }

  type UsageEstimation {
    operations: SafeInt!
  }
`;
