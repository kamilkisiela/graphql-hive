import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    me: User!
  }

  extend type Mutation {
    updateMe(input: UpdateMeInput!): User!
  }

  input UpdateMeInput {
    fullName: String!
    displayName: String!
  }

  type User {
    id: ID!
    email: String!
    fullName: String!
    displayName: String!
    provider: AuthProvider!
  }

  type UserConnection {
    nodes: [User!]!
    total: Int!
  }

  type Member {
    id: ID!
    user: User!
    organizationAccessScopes: [OrganizationAccessScope!]!
    projectAccessScopes: [ProjectAccessScope!]!
    targetAccessScopes: [TargetAccessScope!]!
  }

  type MemberConnection {
    nodes: [Member!]!
    total: Int!
  }

  enum AuthProvider {
    GOOGLE
    GITHUB
    """
    Username-Password-Authentication
    """
    AUTH0
  }

  enum OrganizationAccessScope {
    READ
    DELETE
    SETTINGS
    INTEGRATIONS
    MEMBERS
  }

  enum ProjectAccessScope {
    READ
    DELETE
    SETTINGS
    ALERTS
    OPERATIONS_STORE_READ
    OPERATIONS_STORE_WRITE
  }

  enum TargetAccessScope {
    READ
    DELETE
    SETTINGS
    REGISTRY_READ
    REGISTRY_WRITE
    TOKENS_READ
    TOKENS_WRITE
  }
`;
