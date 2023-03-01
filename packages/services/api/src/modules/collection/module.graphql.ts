import { gql } from 'graphql-modules';

export const typeDefs = gql`
  type Collection {
    id: ID!
    name: String!
    description: String
    createdAt: DateTime!
    updatedAt: DateTime!
    createdBy: User!
    items(first: Int, after: String): CollectionItemsConnection!
  }

  type CollectionConnection {
    nodes: [Collection!]!
    total: Int!
  }

  type CollectionItemsConnection {
    edges: [OperationEdge!]!
    pageInfo: PageInfo!
  }

  type OperationEdge {
    node: Operation!
    cursor: String!
  }

  type Operation {
    id: ID!
    name: String!
    query: String!
    variables: JSON
    headers: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    collection: Collection!
  }

  input CreateCollectionInput {
    targetId: ID!
    name: String!
    description: String
  }

  input UpdateCollectionInput {
    id: ID!
    name: String!
    description: String
  }

  input CreateOperationInput {
    collectionId: ID!
    name: String!
    query: String!
    variables: JSON
    headers: JSON
  }
  input UpdateOperationInput {
    id: ID!
    name: String!
    query: String!
    collectionId: ID!
    variables: JSON
    headers: JSON
  }

  extend type Mutation {
    createOperation(input: CreateOperationInput!): Operation!
    updateOperation(input: UpdateOperationInput!): Operation!
    deleteOperation(id: ID!): Operation!
    createCollection(input: CreateCollectionInput!): Collection!
    updateCollection(input: UpdateCollectionInput!): Collection!
    deleteCollection(id: ID!): Collection!
  }

  extend type Query {
    collections(targetId: ID!): CollectionConnection!
    operation(id: ID!): Operation!
    collection(id: ID!): Collection!
  }
`;
