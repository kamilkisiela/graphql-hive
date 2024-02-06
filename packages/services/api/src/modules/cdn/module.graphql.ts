import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    createCdnAccessToken(input: CreateCdnAccessTokenInput!): CdnAccessTokenCreateResult!
    deleteCdnAccessToken(input: DeleteCdnAccessTokenInput!): DeleteCdnAccessTokenResult!
  }

  type CdnTokenResult {
    token: String!
    url: String!
  }

  extend type Query {
    """
    Whether the CDN integration in Hive is enabled.
    """
    isCDNEnabled: Boolean!
  }

  extend type Target {
    """
    The URL for accessing this target's artifacts via the CDN.
    """
    cdnUrl: String!
    """
    A paginated connection of CDN tokens for accessing this target's artifacts.
    """
    cdnAccessTokens(first: Int, after: String): TargetCdnAccessTokenConnection!
  }

  extend type Contract {
    """
    The URL for accessing this contracts's artifacts via the CDN.
    """
    cdnUrl: String!
  }

  type CdnAccessToken {
    id: ID!
    alias: String!
    firstCharacters: String!
    lastCharacters: String!
    createdAt: DateTime!
  }

  type TargetCdnAccessTokenConnection {
    edges: [TargetCdnAccessTokenEdge!]!
    pageInfo: PageInfo!
  }

  type TargetCdnAccessTokenEdge {
    node: CdnAccessToken!
    cursor: String!
  }

  input DeleteCdnAccessTokenInput {
    selector: TargetSelectorInput!
    cdnAccessTokenId: ID!
  }

  """
  @oneOf
  """
  type DeleteCdnAccessTokenResult {
    ok: DeleteCdnAccessTokenOk
    error: DeleteCdnAccessTokenError
  }

  type DeleteCdnAccessTokenOk {
    deletedCdnAccessTokenId: ID!
  }

  type DeleteCdnAccessTokenError implements Error {
    message: String!
  }

  input CreateCdnAccessTokenInput {
    selector: TargetSelectorInput!
    alias: String!
  }

  """
  @oneOf
  """
  type CdnAccessTokenCreateResult {
    ok: CdnAccessTokenCreateOk
    error: CdnAccessTokenCreateError
  }

  type CdnAccessTokenCreateOk {
    createdCdnAccessToken: CdnAccessToken!
    secretAccessToken: String!
    cdnUrl: String!
  }

  type CdnAccessTokenCreateError implements Error {
    message: String!
  }
`;
