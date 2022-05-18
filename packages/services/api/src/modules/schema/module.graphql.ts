import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    """
    Requires API Token
    """
    schemaPublish(input: SchemaPublishInput!): SchemaPublishPayload!
    """
    Requires API Token
    """
    schemaCheck(input: SchemaCheckInput!): SchemaCheckPayload!
    updateSchemaVersionStatus(input: SchemaVersionUpdateInput!): SchemaVersion!
    updateBaseSchema(input: UpdateBaseSchemaInput!): UpdateBaseSchemaResult!
    updateSchemaServiceName(
      input: UpdateSchemaServiceNameInput!
    ): UpdateSchemaServiceNameResult!
    schemaSyncCDN(input: SchemaSyncCDNInput!): SchemaSyncCDNPayload!
  }

  extend type Query {
    schemaCompare(selector: SchemaCompareInput!): SchemaComparePayload!
    schemaCompareToPrevious(
      selector: SchemaCompareToPreviousInput!
    ): SchemaComparePayload!
    schemaVersions(
      selector: SchemaVersionsInput!
      after: ID
      limit: Int!
    ): SchemaVersionConnection!
    schemaVersion(selector: SchemaVersionInput!): SchemaVersion!
    """
    Requires API Token
    """
    latestVersion: SchemaVersion!
    """
    Requires API Token
    """
    latestValidVersion: SchemaVersion!
  }

  type UpdateSchemaServiceNameResult {
    ok: UpdateSchemaServiceNameOk
    error: UpdateSchemaServiceNameError
  }

  type UpdateSchemaServiceNameOk {
    updatedTarget: Target!
  }

  type UpdateSchemaServiceNameError implements Error {
    message: String!
  }

  type UpdateBaseSchemaResult {
    ok: UpdateBaseSchemaOk
    error: UpdateBaseSchemaError
  }

  type UpdateBaseSchemaOk {
    updatedTarget: Target!
  }

  type UpdateBaseSchemaError implements Error {
    message: String!
  }

  extend type Target {
    latestSchemaVersion: SchemaVersion
    baseSchema: String
    hasSchema: Boolean!
  }

  type SchemaConnection {
    nodes: [Schema!]!
    total: Int!
  }

  type Schema {
    id: ID!
    author: String!
    source: String!
    date: DateTime!
    commit: ID!
    url: String
    service: String
    metadata: String
  }

  union SchemaPublishPayload =
      SchemaPublishSuccess
    | SchemaPublishError
    | SchemaPublishMissingServiceError
    | GitHubSchemaPublishSuccess
    | GitHubSchemaPublishError

  input SchemaPublishInput {
    service: ID
    url: String
    sdl: String!
    author: String!
    commit: String!
    force: Boolean
    metadata: String
    """
    Talk to GitHub Application and create a check-run
    """
    github: Boolean
  }

  union SchemaCheckPayload =
      SchemaCheckSuccess
    | SchemaCheckError
    | GitHubSchemaCheckSuccess
    | GitHubSchemaCheckError

  enum CriticalityLevel {
    Breaking
    Dangerous
    Safe
  }

  type SchemaChange {
    criticality: CriticalityLevel!
    message: String!
    path: [String!]
  }

  type SchemaError {
    message: String!
    path: [String!]
  }

  type SchemaChangeConnection {
    nodes: [SchemaChange!]!
    total: Int!
  }

  type SchemaErrorConnection {
    nodes: [SchemaError!]!
    total: Int!
  }

  type SchemaCheckSuccess {
    valid: Boolean!
    changes: SchemaChangeConnection
  }

  type SchemaCheckError {
    valid: Boolean!
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
  }

  type GitHubSchemaCheckSuccess {
    message: String!
  }

  type GitHubSchemaCheckError {
    message: String!
  }

  type GitHubSchemaPublishSuccess {
    message: String!
  }

  type GitHubSchemaPublishError {
    message: String!
  }

  type SchemaPublishSuccess {
    initial: Boolean!
    valid: Boolean!
    message: String
    changes: SchemaChangeConnection
  }

  type SchemaPublishError {
    valid: Boolean!
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
  }

  type SchemaPublishMissingServiceError {
    message: String!
  }

  input SchemaCheckInput {
    service: ID
    sdl: String!
    github: GitHubSchemaCheckInput
  }

  input GitHubSchemaCheckInput {
    commit: String!
  }

  input SchemaCompareInput {
    organization: ID!
    project: ID!
    target: ID!
    after: ID!
    before: ID!
  }

  input SchemaCompareToPreviousInput {
    organization: ID!
    project: ID!
    target: ID!
    version: ID!
  }

  input SchemaVersionUpdateInput {
    organization: ID!
    project: ID!
    target: ID!
    version: ID!
    valid: Boolean!
  }

  type SchemaCompareResult {
    changes: SchemaChangeConnection!
    diff: SchemaDiff!
    initial: Boolean!
  }

  type SchemaCompareError {
    message: String!
  }

  union SchemaComparePayload = SchemaCompareResult | SchemaCompareError

  type SchemaDiff {
    after: String!
    before: String!
  }

  input SchemaVersionsInput {
    organization: ID!
    project: ID!
    target: ID!
  }

  input SchemaVersionInput {
    organization: ID!
    project: ID!
    target: ID!
    version: ID!
  }

  input UpdateBaseSchemaInput {
    organization: ID!
    project: ID!
    target: ID!
    newBase: String
  }

  input UpdateSchemaServiceNameInput {
    organization: ID!
    project: ID!
    target: ID!
    version: ID!
    name: String!
    newName: String!
  }

  type SchemaVersion {
    id: ID!
    valid: Boolean!
    date: DateTime!
    commit: Schema!
    baseSchema: String
    schemas: SchemaConnection!
    supergraph: String
    sdl: String
  }

  type SchemaVersionConnection {
    nodes: [SchemaVersion!]!
    pageInfo: PageInfo!
  }

  input SchemaSyncCDNInput {
    organization: ID!
    project: ID!
    target: ID!
  }

  type SchemaSyncCDNSuccess {
    message: String!
  }

  type SchemaSyncCDNError {
    message: String!
  }

  union SchemaSyncCDNPayload = SchemaSyncCDNSuccess | SchemaSyncCDNError
`;
