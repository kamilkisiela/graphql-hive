import { gql } from 'graphql-modules';

export const typeDefs = gql`
  type DocumentCollection {
    id: ID!
    name: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
    operations(first: Int, after: String): DocumentCollectionOperationsConnection!
  }

  type DocumentCollectionConnection {
    nodes: [DocumentCollection!]!
    pageInfo: PageInfo!
  }

  type DocumentCollectionOperationsConnection {
    nodes: [DocumentCollectionOperation!]!
    pageInfo: PageInfo!
  }

  type DocumentCollectionOperation {
    id: ID!
    name: String!
    query: String!
    variables: JSON
    headers: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    collection: DocumentCollection!
  }

  input CreateDocumentCollectionInput {
    targetSelector: TargetSelectorInput!
    name: String!
    description: String
  }

  input UpdateDocumentCollectionInput {
    targetSelector: TargetSelectorInput!
    collectionId: ID!
    name: String!
    description: String
  }

  input CreateDocumentCollectionOperationInput {
    targetSelector: TargetSelectorInput!
    collectionId: ID!
    name: String!
    query: String!
    variables: JSON
    headers: JSON
  }

  input UpdateDocumentCollectionOperationInput {
    targetSelector: TargetSelectorInput!
    operationId: ID!
    collectionId: ID!
    name: String!
    query: String!
    variables: JSON
    headers: JSON
  }

  extend type Mutation {
    createOperationInDocumentCollection(
      input: CreateDocumentCollectionOperationInput!
    ): DocumentCollectionOperation!
    updateOperationInDocumentCollection(
      input: UpdateDocumentCollectionOperationInput!
    ): DocumentCollectionOperation!
    deleteOperationInDocumentCollection(id: ID!): Boolean!
    createDocumentCollection(input: CreateDocumentCollectionInput!): DocumentCollection!
    updateDocumentCollection(input: UpdateDocumentCollectionInput!): DocumentCollection!
    deleteDocumentCollection(id: ID!): Boolean!
  }

  extend type Target {
    documentCollection(id: ID!): DocumentCollection!
    documentCollections: DocumentCollectionConnection!
    documentCollectionOperation(id: ID!): DocumentCollectionOperation!
  }
`;
