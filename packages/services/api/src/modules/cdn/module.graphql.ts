import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    createCdnToken(selector: TargetSelectorInput!): CdnTokenResult!
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
    A paginated connection of CDN tokens for accessing this target's artifacts.
    """
    cdnAccessTokens(first: Int, after: String): TargetCdnAccessTokenConnection!
  }

  type CdnAccessToken {
    id: ID!
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
`;
