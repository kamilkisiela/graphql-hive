import { gql } from 'graphql-modules';

export const typeDefs = gql`
  type DocumentCollection {
    id: ID!
    name: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
    operations(first: Int = 100, after: String = null): DocumentCollectionOperationsConnection!
  }

  type DocumentCollectionEdge {
    node: DocumentCollection!
    cursor: String!
  }

  type DocumentCollectionConnection {
    edges: [DocumentCollectionEdge!]!
    pageInfo: PageInfo!
  }

  type DocumentCollectionOperationsConnection {
    edges: [DocumentCollectionOperationEdge!]!
    pageInfo: PageInfo!
  }

  type DocumentCollectionOperation {
    id: ID!
    name: String!
    query: String!
    variables: String
    headers: String
    createdAt: DateTime!
    updatedAt: DateTime!
    collection: DocumentCollection!
  }

  type DocumentCollectionOperationEdge {
    node: DocumentCollectionOperation!
    cursor: String!
  }

  input CreateDocumentCollectionInput {
    name: String!
    description: String
  }

  input UpdateDocumentCollectionInput {
    collectionId: ID!
    name: String!
    description: String
  }

  input CreateDocumentCollectionOperationInput {
    collectionId: ID!
    name: String!
    query: String!
    variables: String
    headers: String
  }

  input UpdateDocumentCollectionOperationInput {
    operationId: ID!
    collectionId: ID!
    name: String
    query: String
    variables: String
    headers: String
  }

  extend type Mutation {
    createOperationInDocumentCollection(
      selector: TargetSelectorInput!
      input: CreateDocumentCollectionOperationInput!
    ): ModifyDocumentCollectionOperationResult!
    updateOperationInDocumentCollection(
      selector: TargetSelectorInput!
      input: UpdateDocumentCollectionOperationInput!
    ): ModifyDocumentCollectionOperationResult!
    deleteOperationInDocumentCollection(
      selector: TargetSelectorInput!
      id: ID!
    ): DeleteDocumentCollectionOperationResult!

    createDocumentCollection(
      selector: TargetSelectorInput!
      input: CreateDocumentCollectionInput!
    ): ModifyDocumentCollectionResult!
    updateDocumentCollection(
      selector: TargetSelectorInput!
      input: UpdateDocumentCollectionInput!
    ): ModifyDocumentCollectionResult!
    deleteDocumentCollection(
      selector: TargetSelectorInput!
      id: ID!
    ): DeleteDocumentCollectionResult!
  }

  type ModifyDocumentCollectionError implements Error {
    message: String!
  }

  """
  @oneOf
  """
  type DeleteDocumentCollectionResult {
    ok: DeleteDocumentCollectionOkPayload
    error: ModifyDocumentCollectionError
  }

  type DeleteDocumentCollectionOkPayload {
    updatedTarget: Target!
    deletedId: ID!
  }

  """
  @oneOf
  """
  type DeleteDocumentCollectionOperationResult {
    ok: DeleteDocumentCollectionOperationOkPayload
    error: ModifyDocumentCollectionError
  }

  type DeleteDocumentCollectionOperationOkPayload {
    updatedTarget: Target!
    updatedCollection: DocumentCollection!
    deletedId: ID!
  }

  """
  @oneOf
  """
  type ModifyDocumentCollectionResult {
    ok: ModifyDocumentCollectionOkPayload
    error: ModifyDocumentCollectionError
  }

  type ModifyDocumentCollectionOkPayload {
    collection: DocumentCollection!
    updatedTarget: Target!
  }

  """
  @oneOf
  """
  type ModifyDocumentCollectionOperationResult {
    ok: ModifyDocumentCollectionOperationOkPayload
    error: ModifyDocumentCollectionError
  }

  type ModifyDocumentCollectionOperationOkPayload {
    operation: DocumentCollectionOperation!
    collection: DocumentCollection!
    updatedTarget: Target!
  }

  extend type Target {
    documentCollection(id: ID!): DocumentCollection
    documentCollections(first: Int = 100, after: String = null): DocumentCollectionConnection!
    documentCollectionOperation(id: ID!): DocumentCollectionOperation
  }
`;
