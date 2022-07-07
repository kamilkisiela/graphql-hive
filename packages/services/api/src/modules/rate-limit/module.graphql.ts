import { gql } from 'graphql-modules';

export default gql`
  type RateLimit {
    limitedForOperations: Boolean!
    operations: SafeInt!
    retentionInDays: Int!
  }

  input RateLimitInput {
    operations: SafeInt!
  }

  extend type Organization {
    rateLimit: RateLimit!
  }
`;
