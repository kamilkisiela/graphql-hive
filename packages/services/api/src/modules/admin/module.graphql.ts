import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    admin: AdminQuery!
  }

  type AdminQuery {
    stats(daysLimit: Int): AdminStats!
  }

  type AdminStats {
    organizations: [AdminOrganizationStats!]!
    general: AdminGeneralStats!
  }

  type AdminOrganizationStats {
    organization: Organization!
    versions: Int!
    users: Int!
    projects: Int!
    targets: Int!
    persistedOperations: Int!
    operations: SafeInt!
  }

  type AdminGeneralStats {
    operationsOverTime: [AdminOperationPoint!]!
  }

  type AdminOperationPoint {
    date: DateTime!
    count: SafeInt!
  }
`;
