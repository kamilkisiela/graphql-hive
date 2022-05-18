import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    """
    Requires API Token
    """
    publishPersistedOperations(
      input: [PublishPersistedOperationInput!]!
    ): PublishPersistedOperationPayload!
    """
    Requires API Token
    """
    deletePersistedOperation(
      selector: PersistedOperationSelectorInput!
    ): DeletePersistedOperationPayload!
  }

  extend type Query {
    """
    Requires API Token
    """
    storedOperations: [PersistedOperation!]!
    """
    Requires API Token
    """
    comparePersistedOperations(hashes: [String!]!): [String!]!
    persistedOperation(
      selector: PersistedOperationSelectorInput!
    ): PersistedOperation
    persistedOperations(
      selector: ProjectSelectorInput!
    ): PersistedOperationConnection!
  }

  input PersistedOperationSelectorInput {
    organization: ID!
    project: ID!
    operation: ID!
  }

  type PersistedOperationSelector {
    organization: ID!
    project: ID!
    operation: ID
  }

  extend type Project {
    persistedOperations: PersistedOperationConnection!
  }

  type PersistedOperationConnection {
    nodes: [PersistedOperation!]!
    total: Int!
  }

  type PersistedOperation {
    id: ID!
    operationHash: ID!
    content: String!
    name: String!
    kind: String!
  }

  input PublishPersistedOperationInput {
    content: String!
    operationHash: String
  }

  type PublishPersistedOperationPayload {
    summary: PublishPersistedOperationsSummary!
    operations: [PersistedOperation!]!
  }

  type PublishPersistedOperationsSummary {
    total: Int!
    unchanged: Int!
  }

  type DeletePersistedOperationPayload {
    selector: PersistedOperationSelector!
    deletedPersistedOperation: PersistedOperation!
  }
`;
