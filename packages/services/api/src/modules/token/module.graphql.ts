import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    tokens(selector: TargetSelectorInput!): TokenConnection!
    tokenInfo: TokenInfoPayload!
  }

  extend type Mutation {
    createToken(input: CreateTokenInput!): CreateTokenPayload!
    deleteTokens(input: DeleteTokensInput!): DeleteTokensPayload!
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
    organization: ID!
    project: ID!
    target: ID!
    name: String!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
  }

  input DeleteTokensInput {
    organization: ID!
    project: ID!
    target: ID!
    tokens: [ID!]!
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
