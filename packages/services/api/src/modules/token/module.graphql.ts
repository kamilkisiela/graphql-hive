import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    tokens(selector: TargetSelectorInput!): TokenConnection!
    tokenInfo: TokenInfoPayload!
  }

  extend type Mutation {
    createToken(input: CreateTokenInput!): CreateTokenResult!
    deleteTokens(input: DeleteTokensInput!): DeleteTokensPayload!
  }

  type CreateTokenResult {
    ok: CreateTokenOk
    error: CreateTokenError
  }

  type CreateTokenOk {
    selector: TargetSelector!
    createdToken: Token!
    secret: String!
  }

  type CreateTokenError implements Error {
    message: String!
  }

  type TokenConnection {
    nodes: [Token!]!
    total: Int!
  }

  type Token {
    id: ID!
    name: String!
    alias: String!
    date: DateTime!
    lastUsedAt: DateTime
  }

  union TokenInfoPayload = TokenInfo | TokenNotFoundError

  type TokenInfo {
    token: Token!
    organization: Organization!
    project: Project!
    target: Target!
    hasTargetScope(scope: TargetAccessScope!): Boolean!
    hasProjectScope(scope: ProjectAccessScope!): Boolean!
    hasOrganizationScope(scope: OrganizationAccessScope!): Boolean!
  }

  type TokenNotFoundError {
    message: String!
  }

  input CreateTokenInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    name: String!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
  }

  input DeleteTokensInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    tokenIds: [ID!]!
  }

  type DeleteTokensPayload {
    selector: TargetSelector!
    deletedTokens: [ID!]!
  }

  type CreateTokenPayload {
    selector: TargetSelector!
    createdToken: Token!
    secret: String!
  }

  extend type Target {
    tokens: TokenConnection!
  }
`;
