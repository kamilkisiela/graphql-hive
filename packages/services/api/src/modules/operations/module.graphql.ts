import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    fieldStats(selector: FieldStatsInput!): FieldStats!
    fieldListStats(selector: FieldListStatsInput!): [FieldStats!]!
    operationsStats(selector: OperationsStatsSelectorInput!): OperationsStats!
    hasCollectedOperations(selector: TargetSelectorInput!): Boolean!
    clientStatsByTargets(selector: ClientStatsByTargetsInput!): ClientStatsConnection!
    operationBodyByHash(selector: OperationBodyByHashInput!): String
  }

  input OperationsStatsSelectorInput {
    organization: ID!
    project: ID!
    target: ID!
    period: DateRangeInput!
    operations: [ID!]
  }

  input OperationBodyByHashInput {
    organization: ID!
    project: ID!
    target: ID!
    hash: String!
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

  type FieldStats {
    type: String!
    field: String!
    argument: String
    count: SafeInt!
    percentage: Float!
  }

  type OperationsStats {
    requestsOverTime(resolution: Int!): [RequestsOverTime!]!
    failuresOverTime(resolution: Int!): [FailuresOverTime!]!
    durationOverTime(resolution: Int!): [DurationOverTime!]!
    totalRequests: SafeInt!
    totalFailures: SafeInt!
    totalOperations: Int!
    durationHistogram(resolution: Int!): [DurationHistogram!]!
    duration: DurationStats!
    operations: OperationStatsConnection!
    clients: ClientStatsConnection!
  }

  type OperationStatsConnection {
    nodes: [OperationStats!]!
    total: Int!
  }

  type ClientStatsConnection {
    nodes: [ClientStats!]!
    total: Int!
  }

  type DurationStats {
    p75: Int!
    p90: Int!
    p95: Int!
    p99: Int!
  }

  type OperationStats {
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
    duration: DurationStats!
  }

  type ClientStats {
    name: String!
    versions: [ClientVersionStats!]!
    count: Int!
    percentage: Float!
  }

  type ClientVersionStats {
    version: String!
    count: Int!
    percentage: Float!
  }

  type ClientNameStats {
    name: String!
    count: Int!
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
    duration: DurationStats!
  }

  type DurationHistogram {
    duration: Int!
    count: SafeInt!
  }

  extend type OrganizationGetStarted {
    reportingOperations: Boolean!
  }
`;
