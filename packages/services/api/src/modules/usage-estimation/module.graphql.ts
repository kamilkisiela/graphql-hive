import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    usageEstimation(input: UsageEstimationInput!): UsageEstimation!
  }

  input UsageEstimationInput {
    range: DateRangeInput!
    organization: String!
  }

  type UsageEstimation {
    operations: SafeInt!
  }
`;
