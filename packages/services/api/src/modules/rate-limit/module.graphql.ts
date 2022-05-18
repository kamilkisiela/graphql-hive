import { gql } from 'graphql-modules';

export default gql`
  type RateLimit {
    limitedForOperations: Boolean!
    limitedForSchemaPushes: Boolean!
    operations: SafeInt!
    schemaPushes: SafeInt!
    retentionInDays: Int!
  }

  input RateLimitInput {
    operations: SafeInt!
    schemaPushes: SafeInt!
  }

  extend type Organization {
    rateLimit: RateLimit!
  }
`;
