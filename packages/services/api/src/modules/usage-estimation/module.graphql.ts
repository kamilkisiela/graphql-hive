import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    usageEstimation(range: DateRangeInput!): UsageEstimationScope!
  }

  type UsageEstimationScope {
    target(selector: TargetSelectorInput!): UsageEstimation!
    org(selector: OrganizationSelectorInput!): UsageEstimation!
  }

  type UsageEstimation {
    schemaPushes: SafeInt!
    operations: SafeInt!
  }
`;
