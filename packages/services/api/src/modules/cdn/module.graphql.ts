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
`;
