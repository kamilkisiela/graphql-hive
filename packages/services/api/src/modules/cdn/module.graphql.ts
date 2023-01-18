import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    createCdnToken(selector: TargetSelectorInput!): CdnTokenResult!
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
    cdnTokens(first: Int, after: String): TargetCdnTokenConnection!
  }

  type TargetCdnTokenConnection {
    edges: [TargetCdnTokenEdge!]!
    pageInfo: PageInfo!
  }

  type TargetCdnTokenEdge {
    node: CdnToken!
    cursor: String!
  }

  type CdnToken {
    id: ID!
    firstCharacters: String!
    lastCharacters: String!
    createdAt: DateTime!
  }
`;
