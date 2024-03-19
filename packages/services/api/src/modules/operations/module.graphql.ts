import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    fieldStats(selector: FieldStatsInput!): FieldStatsValues!
    fieldListStats(selector: FieldListStatsInput!): [FieldStatsValues!]!
    operationsStats(selector: OperationsStatsSelectorInput!): OperationsStats!
    schemaCoordinateStats(selector: SchemaCoordinateStatsInput!): SchemaCoordinateStats!
    clientStats(selector: ClientStatsInput!): ClientStats!
    hasCollectedOperations(selector: TargetSelectorInput!): Boolean!
    clientStatsByTargets(selector: ClientStatsByTargetsInput!): ClientStatsValuesConnection!
  }

  input OperationsStatsSelectorInput {
    organization: ID!
    project: ID!
    target: ID!
    period: DateRangeInput!
    operations: [ID!]
    clientNames: [String!]
  }

  input ClientStatsInput {
    organization: ID!
    project: ID!
    target: ID!
    period: DateRangeInput!
    client: String!
  }

  input SchemaCoordinateStatsInput {
    organization: ID!
    project: ID!
    target: ID!
    period: DateRangeInput!
    schemaCoordinate: String!
  }

  input ClientStatsByTargetsInput {
    organization: ID!
    project: ID!
    targetIds: [ID!]!
    period: DateRangeInput!
  }

  input DateRangeInput {
    from: DateTime!
    to: DateTime!
  }

  type DateRange {
    from: DateTime!
    to: DateTime!
  }

  input FieldStatsInput {
    target: String!
    project: String!
    organization: String!
    type: String!
    field: String!
    argument: String
    period: DateRangeInput!
    operationHash: String
  }

  input FieldListStatsInput {
    target: String!
    project: String!
    organization: String!
    period: DateRangeInput!
    fields: [FieldTypePairInput!]!
    operationHash: String
  }

  input FieldTypePairInput {
    type: String!
    field: String!
    argument: String
  }

  type FieldStatsValues {
    type: String!
    field: String!
    argument: String
    count: SafeInt!
    percentage: Float!
  }

  type ClientStats {
    requestsOverTime(resolution: Int!): [RequestsOverTime!]!
    totalRequests: SafeInt!
    totalVersions: SafeInt!
    operations: OperationStatsValuesConnection!
    versions(limit: Int!): [ClientVersionStatsValues!]!
  }

  type SchemaCoordinateStats {
    requestsOverTime(resolution: Int!): [RequestsOverTime!]!
    totalRequests: SafeInt!
    operations: OperationStatsValuesConnection!
    clients: ClientStatsValuesConnection!
  }

  type OperationsStats {
    requestsOverTime(resolution: Int!): [RequestsOverTime!]!
    failuresOverTime(resolution: Int!): [FailuresOverTime!]!
    durationOverTime(resolution: Int!): [DurationOverTime!]!
    totalRequests: SafeInt!
    totalFailures: SafeInt!
    totalOperations: Int!
    duration: DurationValues!
    operations: OperationStatsValuesConnection!
    clients: ClientStatsValuesConnection!
  }

  type OperationStatsValuesConnection {
    nodes: [OperationStatsValues!]!
    total: Int!
  }

  type ClientStatsValuesConnection {
    nodes: [ClientStatsValues!]!
    total: Int!
  }

  type DurationValues {
    p75: Int!
    p90: Int!
    p95: Int!
    p99: Int!
  }

  type OperationStatsValues {
    id: ID!
    operationHash: String
    kind: String!
    name: String!
    """
    Total number of requests
    """
    count: SafeInt!
    """
    Number of requests that succeeded
    """
    countOk: SafeInt!
    percentage: Float!
    duration: DurationValues!
  }

  type ClientStatsValues {
    name: String!
    versions: [ClientVersionStatsValues!]!
    count: Float!
    percentage: Float!
  }

  type ClientVersionStatsValues {
    version: String!
    count: Float!
    percentage: Float!
  }

  type ClientNameStatsValues {
    name: String!
    count: Float!
  }

  type RequestsOverTime {
    date: DateTime!
    value: SafeInt!
  }

  type FailuresOverTime {
    date: DateTime!
    value: SafeInt!
  }

  type DurationOverTime {
    date: DateTime!
    duration: DurationValues!
  }

  extend type OrganizationGetStarted {
    reportingOperations: Boolean!
  }

  enum GraphQLOperationType {
    query
    mutation
    subscription
  }

  type Operation {
    hash: String!
    name: String
    type: GraphQLOperationType!
    body: String!
  }

  extend type Target {
    requestsOverTime(resolution: Int!, period: DateRangeInput!): [RequestsOverTime!]!
    totalRequests(period: DateRangeInput!): SafeInt!
    operation(hash: String!): Operation
  }

  extend type Project {
    requestsOverTime(resolution: Int!, period: DateRangeInput!): [RequestsOverTime!]!
    totalRequests(period: DateRangeInput!): SafeInt!
  }
`;
