import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    lab(selector: TargetSelectorInput!): Lab
  }
  type Lab {
    schema: String!
    mocks: JSON
  }
`;
