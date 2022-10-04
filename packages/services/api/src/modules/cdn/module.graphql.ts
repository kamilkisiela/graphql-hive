import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    createCdnToken(selector: TargetSelectorInput!): CdnTokenResult!
  }

  type CdnTokenResult {
    token: String!
    url: String!
  }
`;
