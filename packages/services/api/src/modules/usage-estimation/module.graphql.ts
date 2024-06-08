import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    usageEstimation(input: UsageEstimationInput!): UsageEstimation!
  }

  input UsageEstimationInput {
    organization: String!
  }

  type UsageEstimation {
    operations: SafeInt!
    periodStart: Date!
    periodEnd: Date!
  }
`;
