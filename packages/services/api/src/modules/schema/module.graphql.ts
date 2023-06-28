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
    """
    Requires API Token
    """
    schemaDelete(input: SchemaDeleteInput!): SchemaDeleteResult!
    updateSchemaVersionStatus(input: SchemaVersionUpdateInput!): SchemaVersion!
    updateBaseSchema(input: UpdateBaseSchemaInput!): UpdateBaseSchemaResult!
    enableExternalSchemaComposition(
      input: EnableExternalSchemaCompositionInput!
    ): EnableExternalSchemaCompositionResult!
    disableExternalSchemaComposition(
      input: DisableExternalSchemaCompositionInput!
    ): DisableExternalSchemaCompositionResult!
    updateProjectRegistryModel(
      input: UpdateProjectRegistryModelInput!
    ): UpdateProjectRegistryModelResult!
  }

  extend type Query {
    schemaCompareToPrevious(
      selector: SchemaCompareToPreviousInput!
      unstable_forceLegacyComparison: Boolean = False
    ): SchemaComparePayload!
    schemaVersions(selector: SchemaVersionsInput!, after: ID, limit: Int!): SchemaVersionConnection!
    schemaVersion(selector: SchemaVersionInput!): SchemaVersion!
    """
    Requires API Token
    """
    latestVersion: SchemaVersion
    """
    Requires API Token
    """
    latestValidVersion: SchemaVersion
    testExternalSchemaComposition(
      selector: TestExternalSchemaCompositionInput!
    ): TestExternalSchemaCompositionResult!
  }

  input DisableExternalSchemaCompositionInput {
    organization: ID!
    project: ID!
  }

  """
  @oneOf
  """
  type DisableExternalSchemaCompositionResult {
    ok: Project
    error: String
  }

  input EnableExternalSchemaCompositionInput {
    organization: ID!
    project: ID!
    endpoint: String!
    secret: String!
  }

  """
  @oneOf
  """
  type EnableExternalSchemaCompositionResult {
    ok: Project
    error: EnableExternalSchemaCompositionError
  }

  type ExternalSchemaComposition {
    endpoint: String!
  }

  input TestExternalSchemaCompositionInput {
    organization: ID!
    project: ID!
  }

  """
  @oneOf
  """
  type TestExternalSchemaCompositionResult {
    ok: Project
    error: TestExternalSchemaCompositionError
  }

  type TestExternalSchemaCompositionError implements Error {
    message: String!
  }

  input UpdateProjectRegistryModelInput {
    organization: ID!
    project: ID!
    model: RegistryModel!
  }

  enum RegistryModel {
    LEGACY
    MODERN
  }

  """
  @oneOf
  """
  type UpdateProjectRegistryModelResult {
    ok: Project
    error: UpdateProjectRegistryModelError
  }

  type UpdateProjectRegistryModelError implements Error {
    message: String!
  }

  extend type Project {
    externalSchemaComposition: ExternalSchemaComposition
    registryModel: RegistryModel!
    schemaVersionsCount(period: DateRangeInput): Int!
  }

  extend type Target {
    schemaVersionsCount(period: DateRangeInput): Int!
  }

  type EnableExternalSchemaCompositionError implements Error {
    message: String!
    """
    The detailed validation error messages for the input fields.
    """
    inputErrors: EnableExternalSchemaCompositionInputErrors!
  }

  type EnableExternalSchemaCompositionInputErrors {
    endpoint: String
    secret: String
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
    """
    Get a schema check for the target by ID.
    """
    schemaCheck(id: ID!): SchemaCheck
    """
    Get a list of paginated schema checks for a target.
    """
    schemaChecks(first: Int, after: String): SchemaCheckConnection!
  }

  type SchemaConnection {
    nodes: [Schema!]!
    total: Int!
  }

  union RegistryLog = PushedSchemaLog | DeletedSchemaLog

  type PushedSchemaLog {
    id: ID!
    author: String!
    date: DateTime!
    commit: ID!
    service: String
  }

  type DeletedSchemaLog {
    id: ID!
    date: DateTime!
    deletedService: String!
  }

  union Schema = SingleSchema | CompositeSchema

  type SingleSchema {
    id: ID!
    author: String!
    source: String!
    date: DateTime!
    commit: ID!
    metadata: String
  }

  type CompositeSchema {
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
    | SchemaPublishMissingUrlError
    | GitHubSchemaPublishSuccess
    | GitHubSchemaPublishError

  input SchemaPublishInput {
    service: ID
    url: String
    sdl: String!
    author: String!
    commit: String!
    force: Boolean @deprecated(reason: "Enabled by default for newly created projects")
    """
    Accept breaking changes and mark schema as valid (if composable)
    """
    experimental_acceptBreakingChanges: Boolean
      @deprecated(reason: "Enabled by default for newly created projects")
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

  union SchemaDeleteResult = SchemaDeleteSuccess | SchemaDeleteError

  type SchemaDeleteSuccess {
    valid: Boolean!
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
  }

  type SchemaDeleteError {
    valid: Boolean!
    errors: SchemaErrorConnection!
  }

  enum CriticalityLevel {
    Breaking
    Dangerous
    Safe
  }

  type SchemaChange {
    criticality: CriticalityLevel!
    criticalityReason: String
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

  type SchemaWarningConnection {
    nodes: [SchemaCheckWarning!]!
    total: Int!
  }

  type SchemaCheckSuccess {
    valid: Boolean!
    initial: Boolean!
    changes: SchemaChangeConnection
    warnings: SchemaWarningConnection
    schemaCheck: SchemaCheck
  }

  type SchemaCheckWarning {
    message: String!
    source: String
    line: Int
    column: Int
  }

  type SchemaCheckError {
    valid: Boolean!
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
    warnings: SchemaWarningConnection
    schemaCheck: SchemaCheck
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
    linkToWebsite: String
    message: String
    changes: SchemaChangeConnection
  }

  type SchemaPublishError {
    valid: Boolean!
    linkToWebsite: String
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
  }

  type SchemaPublishMissingServiceError {
    message: String!
  }

  type SchemaPublishMissingUrlError {
    message: String!
  }

  input SchemaCheckMetaInput {
    author: String!
    commit: String!
  }

  input SchemaCheckInput {
    service: ID
    sdl: String!
    github: GitHubSchemaCheckInput
    meta: SchemaCheckMetaInput
  }

  input SchemaDeleteInput {
    serviceName: ID!
    dryRun: Boolean
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
    service: ServiceSchemaDiff
    initial: Boolean!
  }

  enum SchemaCompareErrorDetailType {
    graphql
    composition
    policy
  }

  type SchemaCompareErrorDetail {
    message: String!
    type: SchemaCompareErrorDetailType!
  }

  type SchemaCompareError {
    message: String! @deprecated(reason: "Use details instead.")
    details: [SchemaCompareErrorDetail!]
  }

  union SchemaComparePayload = SchemaCompareResult | SchemaCompareError

  type SchemaDiff {
    after: String!
    before: String
  }

  type ServiceSchemaDiff {
    name: String!
    after: String
    before: String
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

  type SchemaVersion {
    id: ID!
    valid: Boolean!
    date: DateTime!
    log: RegistryLog!
    baseSchema: String
    schemas: SchemaConnection!
    supergraph: String
    sdl: String
    """
    Experimental: This field is not stable and may change in the future.
    """
    explorer(usage: SchemaExplorerUsageInput): SchemaExplorer!
    errors: SchemaErrorConnection!
  }

  type SchemaVersionConnection {
    nodes: [SchemaVersion!]!
    pageInfo: PageInfo!
  }

  input SchemaExplorerUsageInput {
    period: DateRangeInput!
  }

  type SchemaExplorer {
    types: [GraphQLNamedType!]!
    type(name: String!): GraphQLNamedType
    query: GraphQLObjectType
    mutation: GraphQLObjectType
    subscription: GraphQLObjectType
  }

  type SchemaCoordinateUsage {
    total: Float!
    isUsed: Boolean!
    """
    A list of clients that use this schema coordinate within GraphQL operation documents.
    Is null if used by none clients.
    """
    usedByClients: [String!]
  }

  type SupergraphMetadata {
    """
    List of service names that own the field/type.
    Resolves to null if the entity (field, type, scalar) does not belong to any service.
    """
    ownedByServiceNames: [String!]
  }

  union GraphQLNamedType =
      GraphQLObjectType
    | GraphQLInterfaceType
    | GraphQLUnionType
    | GraphQLEnumType
    | GraphQLInputObjectType
    | GraphQLScalarType

  type GraphQLObjectType {
    name: String!
    description: String
    fields: [GraphQLField!]!
    interfaces: [String!]!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLInterfaceType {
    name: String!
    description: String
    fields: [GraphQLField!]!
    interfaces: [String!]!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available.
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLUnionType {
    name: String!
    description: String
    members: [GraphQLUnionTypeMember!]!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLUnionTypeMember {
    name: String!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLEnumType {
    name: String!
    description: String
    values: [GraphQLEnumValue!]!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available.
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLInputObjectType {
    name: String!
    description: String
    fields: [GraphQLInputField!]!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLScalarType {
    name: String!
    description: String
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLField {
    name: String!
    description: String
    type: String!
    args: [GraphQLArgument!]!
    isDeprecated: Boolean!
    deprecationReason: String
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available.
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLInputField {
    name: String!
    description: String
    type: String!
    defaultValue: String
    isDeprecated: Boolean!
    deprecationReason: String
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLArgument {
    name: String!
    description: String
    type: String!
    defaultValue: String
    isDeprecated: Boolean!
    deprecationReason: String
    usage: SchemaCoordinateUsage!
  }

  type GraphQLEnumValue {
    name: String!
    description: String
    isDeprecated: Boolean!
    deprecationReason: String
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available.
    """
    supergraphMetadata: SupergraphMetadata
  }

  type CodePosition {
    line: Int!
    column: Int!
  }

  type SchemaPolicyWarning {
    message: String!
    ruleId: String!
    start: CodePosition!
    end: CodePosition
  }

  type SchemaPolicyWarningEdge {
    node: SchemaPolicyWarning!
    cursor: String!
  }

  type SchemaPolicyWarningConnection {
    edges: [SchemaPolicyWarningEdge!]!
    pageInfo: PageInfo!
  }

  type SchemaCheckMeta {
    author: String!
    commit: String!
  }

  interface SchemaCheck {
    id: ID!
    createdAt: String!
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String!
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String
  }

  """
  A successful schema check.
  """
  type SuccessfulSchemaCheck implements SchemaCheck {
    id: ID!
    createdAt: String!
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String!
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String

    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection

    compositeSchemaSDL: String
    supergraphSDL: String
  }

  """
  A failed schema check.
  """
  type FailedSchemaCheck implements SchemaCheck {
    id: ID!
    createdAt: String!
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String!
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String

    compositionErrors: SchemaErrorConnection

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    schemaPolicyErrors: SchemaPolicyWarningConnection

    compositeSchemaSDL: String
    supergraphSDL: String
  }

  type SchemaCheckEdge {
    node: SchemaCheck!
    cursor: String!
  }

  type SchemaCheckConnection {
    edges: [SchemaCheckEdge!]!
    pageInfo: PageInfo!
  }
`;
