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
    updateNativeFederation(input: UpdateNativeFederationInput!): UpdateNativeFederationResult!
    enableExternalSchemaComposition(
      input: EnableExternalSchemaCompositionInput!
    ): EnableExternalSchemaCompositionResult!
    disableExternalSchemaComposition(
      input: DisableExternalSchemaCompositionInput!
    ): DisableExternalSchemaCompositionResult!
    updateProjectRegistryModel(
      input: UpdateProjectRegistryModelInput!
    ): UpdateProjectRegistryModelResult!
    """
    Approve a failed schema check with breaking changes.
    """
    approveFailedSchemaCheck(input: ApproveFailedSchemaCheckInput!): ApproveFailedSchemaCheckResult!
    """
    Create a contract for a given target.
    """
    createContract(input: CreateContractInput!): CreateContractResult!
    """
    Disable a contract.
    """
    disableContract(input: DisableContractInput!): DisableContractResult!
  }

  extend type Query {
    """
    Requires API Token
    """
    schemaVersionForActionId(actionId: ID!): SchemaVersion
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

  input UpdateNativeFederationInput {
    organization: ID!
    project: ID!
    enabled: Boolean!
  }

  """
  @oneOf
  """
  type UpdateNativeFederationResult {
    ok: Project
    error: UpdateNativeFederationError
  }

  type UpdateNativeFederationError implements Error {
    message: String!
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
    isNativeFederationEnabled: Boolean!
    nativeFederationCompatibility: NativeFederationCompatibilityStatus!
  }

  extend type Target {
    schemaVersionsCount(period: DateRangeInput): Int!
  }

  enum NativeFederationCompatibilityStatus {
    COMPATIBLE
    INCOMPATIBLE
    UNKNOWN
    NOT_APPLICABLE
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
    """
    The latest valid (composable) schema version.
    """
    latestValidSchemaVersion: SchemaVersion
    baseSchema: String
    hasSchema: Boolean!
    """
    Get a schema check for the target by ID.
    """
    schemaCheck(id: ID!): SchemaCheck
    """
    Get a list of paginated schema checks for a target.
    """
    schemaChecks(first: Int, after: String, filters: SchemaChecksFilter): SchemaCheckConnection!
    schemaVersions(first: Int, after: String): SchemaVersionConnection!
    schemaVersion(id: ID!): SchemaVersion
    """
    Get a list of paginated schema contracts for the target.
    """
    contracts(first: Int, after: String): ContractConnection!
    """
    Get a list of paginated schema contracts that are active for the target.
    """
    activeContracts(first: Int, after: String): ContractConnection!

    """
    Whether any subscription operations were reported for this target.
    """
    hasCollectedSubscriptionOperations: Boolean!
  }

  input SchemaChecksFilter {
    failed: Boolean
    changed: Boolean
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
    """
    The serviceSDL of the pushed schema. Is null for single schema projects.
    """
    serviceSdl: String
    """
    The previous SDL of the pushed schema. Is null for single schema projects.
    """
    previousServiceSdl: String
  }

  type DeletedSchemaLog {
    id: ID!
    date: DateTime!
    deletedService: String!
    """
    The previous SDL of the full schema or subgraph.
    """
    previousServiceSdl: String
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
    | SchemaPublishSuccess
    | SchemaPublishError
    | SchemaPublishMissingServiceError
    | SchemaPublishMissingUrlError
    | GitHubSchemaPublishSuccess
    | GitHubSchemaPublishError

  input SchemaPublishGitHubInput {
    """
    The repository name.
    """
    repository: String!
    """
    The commit sha.
    """
    commit: String!
  }

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
    github: Boolean @deprecated(reason: "Use SchemaPublishInput.gitHub instead.")
    """
    Link GitHub version to a GitHub commit on a repository.
    """
    gitHub: SchemaPublishGitHubInput
  }

  union SchemaCheckPayload =
    | SchemaCheckSuccess
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
    message(
      """
      Whether to include a note about the safety of the change based on usage data within the message.
      """
      withSafeBasedOnUsageNote: Boolean = true
    ): String!
    path: [String!]
    """
    Approval metadata for this schema change.
    This field is populated in case the breaking change was manually approved.
    """
    approval: SchemaChangeApproval
    """
    Whether the breaking change is safe based on usage data.
    """
    isSafeBasedOnUsage: Boolean!
    """
    Usage statistics about the schema change if it is not safe based on usage.
    The statistics are determined based on the breaking change configuration.
    The usage statistics are only available for breaking changes and only represent a snapshot of the usage data at the time of the schema check/schema publish.
    """
    usageStatistics: SchemaChangeUsageStatistics
  }

  type SchemaChangeUsageStatistics {
    """
    List of the top operations that are affected by this schema change.
    """
    topAffectedOperations: [SchemaChangeUsageStatisticsAffectedOperation!]!
    """
    List of top clients that are affected by this schema change.
    """
    topAffectedClients: [SchemaChangeUsageStatisticsAffectedClient!]!
  }

  type SchemaChangeUsageStatisticsAffectedOperation {
    """
    Name of the operation.
    """
    name: String!
    """
    Hash of the operation.
    """
    hash: String!
    """
    The number of times the operation was called in the period.
    """
    count: Float!
    """
    Human readable count value.
    """
    countFormatted: String!
    """
    The percentage share of the operation of the total traffic.
    """
    percentage: Float!
    """
    Human readable percentage value.
    """
    percentageFormatted: String!
  }

  type SchemaChangeUsageStatisticsAffectedClient {
    """
    Name of the client.
    """
    name: String!
    """
    The number of times the client called the operation in the period.
    """
    count: Float!
    """
    Human readable count value.
    """
    countFormatted: String!
    """
    The percentage share of the client of the total traffic.
    """
    percentage: Float!
    """
    Human readable percentage value.
    """
    percentageFormatted: String!
  }

  type SchemaChangeApproval {
    """
    User that approved this schema change.
    """
    approvedBy: User
    """
    Date of the schema change approval.
    """
    approvedAt: DateTime!
    """
    ID of the schema check in which this change was first approved.
    """
    schemaCheckId: ID!
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

  type BreakingChangeMetadataTarget {
    name: String!
    target: Target
  }

  type SchemaCheckConditionalBreakingChangeMetadataSettings {
    retentionInDays: Int!
    percentage: Float!
    excludedClientNames: [String!]
    targets: [BreakingChangeMetadataTarget!]!
  }

  type SchemaCheckConditionalBreakingChangeMetadataUsage {
    """
    Total amount of requests for the settings and period.
    """
    totalRequestCount: Float!
    """
    Total request count human readable.
    """
    totalRequestCountFormatted: String!
  }

  type SchemaCheckConditionalBreakingChangeMetadata {
    period: DateRange!
    settings: SchemaCheckConditionalBreakingChangeMetadataSettings!
    usage: SchemaCheckConditionalBreakingChangeMetadataUsage!
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
    """
    Optional context ID to group schema checks together.
    Manually approved breaking changes will be memorized for schema checks with the same context id.
    """
    contextId: String
  }

  input SchemaDeleteInput {
    serviceName: ID!
    dryRun: Boolean
  }

  input GitHubSchemaCheckInput {
    commit: String!
    """
    The repository name of the schema check.
    """
    repository: String
    """
    The pull request number of the schema check.
    """
    pullRequestNumber: String
  }

  input SchemaCompareInput {
    organization: ID!
    project: ID!
    target: ID!
    after: ID!
    before: ID!
  }

  input SchemaVersionUpdateInput {
    organization: ID!
    project: ID!
    target: ID!
    version: ID!
    valid: Boolean!
  }

  input UpdateBaseSchemaInput {
    organization: ID!
    project: ID!
    target: ID!
    newBase: String
  }

  type ContractVersionEdge {
    node: ContractVersion!
    cursor: String!
  }

  type ContractVersionConnection {
    edges: [ContractVersionEdge!]!
    pageInfo: PageInfo!
  }

  type SchemaVersion {
    id: ID!
    """
    A schema version is valid if the composition and contract compositions are successful.
    """
    valid: Boolean!
    """
    Whether this schema version is composable.
    """
    isComposable: Boolean!
    """
    Whether this schema version has schema changes.
    """
    hasSchemaChanges: Boolean!
    date: DateTime!
    log: RegistryLog!
    baseSchema: String
    schemas: SchemaConnection!
    supergraph: String
    sdl: String
    """
    List of tags in the schema version. E.g. when using Federation.
    Tags can be used for filtering the schema via contracts.
    """
    tags: [String!]
    """
    Experimental: This field is not stable and may change in the future.
    """
    explorer(usage: SchemaExplorerUsageInput): SchemaExplorer
    unusedSchema(usage: UnusedSchemaExplorerUsageInput): UnusedSchemaExplorer

    schemaCompositionErrors: SchemaErrorConnection

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection

    """
    GitHub metadata associated with the schema version.
    """
    githubMetadata: SchemaVersionGithubMetadata
    """
    The schema version against which this schema version was compared to in order to determine schema changes.
    """
    previousDiffableSchemaVersion: SchemaVersion
    """
    Whether this is the first composable schema version.
    """
    isFirstComposableVersion: Boolean!
    """
    Contract versions of this schema version.
    """
    contractVersions: ContractVersionConnection
  }

  type SchemaVersionGithubMetadata {
    repository: String!
    commit: String!
  }

  type SchemaVersionEdge {
    node: SchemaVersion!
    cursor: String!
  }

  type SchemaVersionConnection {
    edges: [SchemaVersionEdge!]!
    pageInfo: PageInfo!
  }

  input SchemaExplorerUsageInput {
    period: DateRangeInput!
  }

  input UnusedSchemaExplorerUsageInput {
    period: DateRangeInput!
  }

  type SchemaExplorer {
    types: [GraphQLNamedType!]!
    type(name: String!): GraphQLNamedType
    query: GraphQLObjectType
    mutation: GraphQLObjectType
    subscription: GraphQLObjectType
  }

  type UnusedSchemaExplorer {
    types: [GraphQLNamedType!]!
  }

  type SchemaCoordinateUsage {
    total: Float!
    isUsed: Boolean!
    """
    A list of clients that use this schema coordinate within GraphQL operation documents.
    Is null if used by none clients.
    """
    usedByClients: [String!]
    topOperations(limit: Int!): [SchemaCoordinateUsageOperation!]!
  }

  type SchemaCoordinateUsageOperation {
    name: String!
    hash: String!
    """
    The number of times the operation was called.
    """
    count: Float!
  }

  type SupergraphMetadata {
    """
    List of service names that own the field/type.
    Resolves to null if the entity (field, type, scalar) does not belong to any service.
    """
    ownedByServiceNames: [String!]
  }

  union GraphQLNamedType =
    | GraphQLObjectType
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
    ruleId: String
    start: CodePosition
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
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
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
    """
    The GitHub repository associated with the schema check.
    """
    githubRepository: String

    """
    Whether this schema check has any composition errors.
    """
    hasSchemaCompositionErrors: Boolean!
    """
    Whether this schema check has any breaking changes.
    """
    hasUnapprovedBreakingChanges: Boolean!
    """
    Whether this schema check has any schema changes.
    """
    hasSchemaChanges: Boolean!

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    schemaPolicyErrors: SchemaPolicyWarningConnection
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata
  }

  """
  Schema check result for contracts
  """
  type ContractCheck {
    id: ID!
    contractName: String!

    """
    Whether this schema check has any composition errors.
    """
    hasSchemaCompositionErrors: Boolean!
    """
    Whether this schema check has any breaking changes.
    """
    hasUnapprovedBreakingChanges: Boolean!
    """
    Whether this schema check has any schema changes.
    """
    hasSchemaChanges: Boolean!

    schemaCompositionErrors: SchemaErrorConnection

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection

    compositeSchemaSDL: String
    supergraphSDL: String

    isSuccess: Boolean!

    """
    The contract version against this check was performed.
    """
    contractVersion: ContractVersion
  }

  type ContractCheckEdge {
    cursor: String!
    node: ContractCheck!
  }

  type ContractCheckConnection {
    edges: [ContractCheckEdge!]!
    pageInfo: PageInfo!
  }

  type ContractVersion {
    id: ID!
    createdAt: String!
    contractName: String!

    """
    Whether this contract version is composable.
    """
    isComposable: Boolean!
    schemaCompositionErrors: SchemaErrorConnection

    supergraphSDL: String
    compositeSchemaSDL: String
    """
    Whether this contract versions has schema changes.
    """
    hasSchemaChanges: Boolean!
    """
    Breaking schema changes for this contract version.
    """
    breakingSchemaChanges: SchemaChangeConnection
    """
    Safe schema changes for this contract version.
    """
    safeSchemaChanges: SchemaChangeConnection

    previousContractVersion: ContractVersion
    previousDiffableContractVersion: ContractVersion

    isFirstComposableVersion: Boolean!
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
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
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
    """
    The GitHub repository associated with the schema check.
    """
    githubRepository: String

    """
    Whether this schema check has any composition errors.
    """
    hasSchemaCompositionErrors: Boolean!
    """
    Whether this schema check has any breaking changes.
    """
    hasUnapprovedBreakingChanges: Boolean!
    """
    Whether this schema check has any schema changes.
    """
    hasSchemaChanges: Boolean!

    """
    Breaking changes can exist in an successful schema check if the check was manually approved.
    """
    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    """
    Schema policy errors can exist in an successful schema check if the check was manually approved.
    """
    schemaPolicyErrors: SchemaPolicyWarningConnection

    compositeSchemaSDL: String
    supergraphSDL: String
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata

    """
    Whether the schema check was manually approved.
    """
    isApproved: Boolean!
    """
    The user that approved the schema check.
    """
    approvedBy: User
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
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
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
    """
    The GitHub repository associated with the schema check.
    """
    githubRepository: String

    compositionErrors: SchemaErrorConnection

    """
    Whether this schema check has any composition errors.
    """
    hasSchemaCompositionErrors: Boolean!
    """
    Whether this schema check has any breaking changes.
    """
    hasUnapprovedBreakingChanges: Boolean!
    """
    Whether this schema check has any schema changes.
    """
    hasSchemaChanges: Boolean!

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    schemaPolicyErrors: SchemaPolicyWarningConnection

    compositeSchemaSDL: String
    supergraphSDL: String
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata

    """
    Whether this schema check can be approved manually.
    """
    canBeApproved: Boolean!
    """
    Whether this schema check can be approved by the viewer.
    """
    canBeApprovedByViewer: Boolean!
  }

  type SchemaCheckEdge {
    node: SchemaCheck!
    cursor: String!
  }

  type SchemaCheckConnection {
    edges: [SchemaCheckEdge!]!
    pageInfo: PageInfo!
  }

  type ContractEdge {
    node: Contract!
    cursor: String!
  }

  type ContractConnection {
    edges: [ContractEdge!]!
    pageInfo: PageInfo!
  }

  input ApproveFailedSchemaCheckInput {
    organization: ID!
    project: ID!
    target: ID!
    schemaCheckId: ID!
  }

  type ApproveFailedSchemaCheckResult {
    ok: ApproveFailedSchemaCheckOk
    error: ApproveFailedSchemaCheckError
  }

  type ApproveFailedSchemaCheckOk {
    schemaCheck: SchemaCheck!
  }

  type ApproveFailedSchemaCheckError {
    message: String!
  }

  input CreateContractInput {
    targetId: ID!
    contractName: String!
    includeTags: [String!]
    excludeTags: [String!]
    removeUnreachableTypesFromPublicApiSchema: Boolean!
  }

  type CreateContractResult {
    ok: CreateContractResultOk
    error: CreateContractResultError
  }

  type CreateContractResultOk {
    createdContract: Contract!
  }

  type CreateContractResultError implements Error {
    message: String!
    details: CreateContractInputErrors!
  }

  type CreateContractInputErrors {
    targetId: String
    contractName: String
    includeTags: String
    excludeTags: String
  }

  input DisableContractInput {
    contractId: ID!
  }

  type DisableContractResult {
    ok: DisableContractResultOk
    error: DisableContractResultError
  }

  type DisableContractResultOk {
    disabledContract: Contract!
  }

  type DisableContractResultError implements Error {
    message: String!
  }

  type Contract {
    id: ID!
    target: Target!
    contractName: String!
    includeTags: [String!]
    excludeTags: [String!]
    removeUnreachableTypesFromPublicApiSchema: Boolean!
    createdAt: DateTime!
    isDisabled: Boolean!
    viewerCanDisableContract: Boolean!
  }
`;
