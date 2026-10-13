import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    schemaPublish(input: SchemaPublishInput!): SchemaPublishPayload!
    schemaPush(input: SchemaPushInput!): SchemaPushResult!
    schemaCheck(input: SchemaCheckInput!): SchemaCheckPayload!
    schemaDelete(input: SchemaDeleteInput!): SchemaDeleteResult!
    schemaCompose(input: SchemaComposeInput!): SchemaComposePayload!
    """
    Promote a schema version within a project to a graph.
    e.g. for rollbacks within a target or multi-stage environment deployments cross targets.
    """
    schemaVersionPromote(input: SchemaVersionPromoteInput!): SchemaVersionPromoteResult!

    updateBaseSchema(input: UpdateBaseSchemaInput!): UpdateBaseSchemaResult!
    """
    Update the schema composition configuration of a federation project.
    """
    updateSchemaComposition(
      input: UpdateSchemaCompositionInput! @tag(name: "public")
    ): UpdateSchemaCompositionResult! @tag(name: "public")
    """
    Approve a failed schema check with breaking changes.
    """
    approveFailedSchemaCheck(input: ApproveFailedSchemaCheckInput!): ApproveFailedSchemaCheckResult!
    """
    Create a contract for a given target.
    """
    createContract(input: CreateContractInput! @tag(name: "public")): CreateContractResult!
      @tag(name: "public")
    """
    Permanently delete a contract.
    """
    deleteContract(input: DeleteContractInput! @tag(name: "public")): DeleteContractResult!
      @tag(name: "public")
  }

  extend type Query {
    schemaVersionForActionId(actionId: ID!, target: TargetReferenceInput): SchemaVersion
      @deprecated(reason: "Use Query.schemaVersionByCommit")

    """
    Returns the latest SchemaVersion associated with a specific commit
    """
    schemaVersionByCommit(commit: String!, target: TargetReferenceInput): SchemaVersion
    latestValidVersion(target: TargetReferenceInput): SchemaVersion
    """
    Requires API Token
    """
    latestVersion: SchemaVersion
    testExternalSchemaComposition(
      selector: TestExternalSchemaCompositionInput!
    ): TestExternalSchemaCompositionResult!
  }

  input SchemaCompositionExternalMethodInput @tag(name: "public") {
    endpoint: String!
    secret: String!
  }

  input SchemaCompositionMethodInput @oneOf @tag(name: "public") {
    """
    Use the native federation schema composition. This is the default method for new projects.
    """
    native: Boolean
    """
    Use an external schema composition endpoint.
    """
    external: SchemaCompositionExternalMethodInput
    """
    Use the legacy federation v1 schema composition.
    """
    legacy: Boolean
  }

  input UpdateSchemaCompositionInput @tag(name: "public") {
    """
    Reference to the project on which the schema composition should be applied.
    """
    project: ProjectReferenceInput!
    """
    The composition method that should be set for the project.
    """
    method: SchemaCompositionMethodInput!
  }

  type UpdateSchemaCompositionResultOk @tag(name: "public") {
    updatedProject: Project!
  }

  """
  @oneOf
  """
  type UpdateSchemaCompositionResult @tag(name: "public") {
    ok: UpdateSchemaCompositionResultOk
    error: UpdateSchemaCompositionError
  }

  interface UpdateSchemaCompositionError @tag(name: "public") {
    message: String!
  }

  type UpdateSchemaCompositionNativeError implements UpdateSchemaCompositionError
    @tag(name: "public") {
    message: String!
  }

  type UpdateSchemaCompositionLegacyError implements UpdateSchemaCompositionError
    @tag(name: "public") {
    message: String!
  }

  type UpdateSchemaCompositionExternalError implements UpdateSchemaCompositionError
    @tag(name: "public") {
    message: String!
    inputErrors: UpdateSchemaCompositionExternalInputErrors
  }

  type UpdateSchemaCompositionExternalInputErrors @tag(name: "public") {
    endpoint: String
    secret: String
  }

  type ExternalSchemaComposition {
    endpoint: String!
  }

  input TestExternalSchemaCompositionInput {
    organizationSlug: String!
    projectSlug: String!
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

  extend type Project {
    externalSchemaComposition: ExternalSchemaComposition
    schemaVersionsCount(period: DateRangeInput): Int!
    isNativeFederationEnabled: Boolean!
    """
    Get the status of the native federation compatability for the project.
    """
    nativeFederationCompatibility: NativeCompositionCompatibility!
  }

  extend type Target {
    schemaVersionsCount(period: DateRangeInput): Int!
  }

  type NativeCompositionVersionStatus {
    target: Target!
    """
    The schema version we check against.
    """
    schemaVersion: SchemaVersion
    """
    The native composition result. The supergraphSdl is sorted and normalized.
    """
    nativeCompositionResult: SchemaCompositionResult
    """
    The supergraph of the latest valid schema version (sorted and normalized).
    """
    currentSupergraphSdl: String
  }

  type NativeCompositionCompatibility {
    """
    Whether the schema version is compatible.
    """
    status: NativeFederationCompatibilityStatusType!
    results: [NativeCompositionVersionStatus]!
  }

  enum NativeFederationCompatibilityStatusType {
    COMPATIBLE
    INCOMPATIBLE
    UNKNOWN
    NOT_APPLICABLE
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
    """
    The latest (potentially invalid) schema version.
    """
    latestSchemaVersion: SchemaVersion @tag(name: "public")
    """
    The latest valid (composable) schema version.
    """
    latestValidSchemaVersion: SchemaVersion @tag(name: "public")
    baseSchema: String
    hasSchema: Boolean!
    """
    Get a schema check for the target by ID.
    """
    schemaCheck(id: ID! @tag(name: "public")): SchemaCheck @tag(name: "public")
    """
    Get a list of paginated schema checks for a target.
    """
    schemaChecks(
      first: Int @tag(name: "public")
      after: String @tag(name: "public")
      filters: SchemaChecksFilter
    ): SchemaCheckConnection! @tag(name: "public")
    """
    Paginated list of schema versions, ordered from recent to oldest.
    """
    schemaVersions(
      first: Int @tag(name: "public")
      after: String @tag(name: "public")
    ): SchemaVersionConnection! @tag(name: "public")
    """
    Retreive a specific schema version in this target by it's id.
    """
    schemaVersion(id: ID! @tag(name: "public")): SchemaVersion @tag(name: "public")
    """
    Get a list of paginated schema contracts for the target.
    """
    contracts(
      first: Int @tag(name: "public")
      after: String @tag(name: "public")
    ): ContractConnection! @tag(name: "public")
    """
    Whether any subscription operations were reported for this target.
    """
    hasCollectedSubscriptionOperations: Boolean!

    """
    Whether this feature has been enabled for the organization and the target
    has sent usage data matching the required format. If either of these cases
    are false, then this returns false.
    """
    fieldLevelMetricsDisplayState: FieldLevelMetricsDisplayState!
  }

  enum FieldLevelMetricsDisplayState {
    ON
    OFF
    ON_WITH_WARNING
  }

  input SchemaChecksFilter {
    failed: Boolean
    changed: Boolean
    serviceName: String
  }

  type SchemaConnection {
    nodes: [Schema!]! @deprecated(reason: "Use 'SchemaConnection.edges' instead.")
    total: Int! @deprecated(reason: "This field will be removed.")
    edges: [SchemaEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type SchemaEdge {
    cursor: String! @tag(name: "public")
    node: Schema! @tag(name: "public")
  }

  union RegistryLog @tag(name: "public") = PushedSchemaLog | DeletedSchemaLog | PromotionSchemaLog

  type PushedSchemaLog {
    id: ID!
    author: String!
    date: DateTime!
    commit: ID!
    """
    The name of the service that got published.
    """
    service: String @tag(name: "public")
    """
    The serviceSDL of the pushed schema. Is null for single schema projects.
    """
    serviceSdl: String @tag(name: "public")
    """
    The previous SDL of the pushed schema. Is null for single schema projects.
    """
    previousServiceSdl: String @tag(name: "public")
  }

  type DeletedSchemaLog {
    id: ID!
    date: DateTime!
    """
    The name of the service that got deleted.
    """
    deletedService: String! @tag(name: "public")
    """
    The previous SDL of the full schema or subgraph.
    """
    previousServiceSdl: String @tag(name: "public")
  }

  type PromotionSchemaLog {
    """
    The origin of this schema log promotion.
    """
    _: Boolean @tag(name: "public")
  }

  union Schema @tag(name: "public") = SingleSchema | CompositeSchema

  type SingleSchema {
    id: ID!
    author: String! @tag(name: "public")
    source: String! @tag(name: "public")
    date: DateTime!
    commit: ID! @tag(name: "public")
    metadata: String
    revision: SchemaRevision
  }

  type CompositeSchema {
    id: ID!
    author: String! @tag(name: "public")
    source: String! @tag(name: "public")
    date: DateTime!
    commit: ID! @tag(name: "public")
    url: String @tag(name: "public")
    service: String @tag(name: "public")
    metadata: String
    revision: SchemaRevision
  }

  union SchemaPublishPayload =
    | SchemaPublishSuccess
    | SchemaPublishRetry
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
    target: TargetReferenceInput
    service: ID
    url: String
    sdl: String @deprecated(reason: "Use 'SchemaPublishInput.schema' instead.")
    schema: SchemaPublishSchemaInput
    author: String!
    commit: String!
    force: Boolean @deprecated(reason: "Enabled by default for newly created projects")
    """
    Accept breaking changes and mark schema as valid (if composable)
    """
    experimental_acceptBreakingChanges: Boolean
      @deprecated(reason: "Enabled by default for newly created projects")
    """
    Prevent publishing a federation schema if it would cause a composition error.
    """
    failOnCompositionError: Boolean = false
    metadata: String
    """
    Talk to GitHub Application and create a check-run
    """
    github: Boolean @deprecated(reason: "Use SchemaPublishInput.gitHub instead.")
    """
    Link GitHub version to a GitHub commit on a repository.
    """
    gitHub: SchemaPublishGitHubInput
    """
    Whether the CLI supports retrying the schema publish, in case acquiring the schema publish lock fails due to a busy queue.
    """
    supportsRetry: Boolean = false
  }

  input SchemaPublishSchemaInput @oneOf {
    """
    Publish a specific sdl as the schema.
    """
    sdl: String
    """
    Publish a schema revision that was previously pushed via 'Mutation.schemaPush'.
    """
    revision: String
  }

  input SchemaPushInput {
    target: TargetReferenceInput!
    service: String
    sdl: String!
    revision: String!
  }

  type SchemaRevision {
    id: ID!
    service: String
    digest: String!
    revision: String!
    createdAt: DateTime!
    expiresAt: DateTime
  }

  type SchemaPushOk {
    schemaRevision: SchemaRevision!
  }

  type SchemaPushError {
    message: String!
  }

  type SchemaPushResult {
    ok: SchemaPushOk
    error: SchemaPushError
  }

  input SchemaComposeInput {
    target: TargetReferenceInput
    services: [SchemaComposeServiceInput!]!
    """
    Whether to use the latest composable version or just latest schema version for the composition.
    Latest schema version may or may not be composable.
    It's true by default, which means the latest composable schema version is used.
    """
    useLatestComposableVersion: Boolean = true
  }

  input SchemaComposeServiceInput {
    name: String!
    sdl: String!
    url: String
  }

  union SchemaComposePayload = SchemaComposeSuccess | SchemaComposeError

  type SchemaComposeSuccess {
    valid: Boolean!
    compositionResult: SchemaCompositionResult!
  }

  """
  @oneOf
  """
  type SchemaCompositionResult {
    """
    How long the composition took in milliseconds
    """
    duration: Int!
    supergraphSdl: String
    errors: SchemaErrorConnection
  }

  type SchemaComposeError implements Error {
    message: String!
  }

  union SchemaCheckPayload =
    | SchemaCheckSuccess
    | SchemaCheckError
    | GitHubSchemaCheckSuccess
    | GitHubSchemaCheckError

  union SchemaDeleteResult = SchemaDeleteSuccess | SchemaDeleteError | SchemaDeleteRetry

  type SchemaDeleteRetry {
    """
    The reason for the retry.
    """
    reason: String!
  }

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
      @deprecated(
        reason: "Use 'SeverityLevelType' instead. This field will be removed once it is no longer in use by a client."
      )
    Dangerous
      @deprecated(
        reason: "Use 'SeverityLevelType' instead. This field will be removed once it is no longer in use by a client."
      )
    Safe
      @deprecated(
        reason: "Use 'SeverityLevelType' instead. This field will be removed once it is no longer in use by a client."
      )
  }

  """
  Describes the impact of a schema change.
  """
  enum SeverityLevelType {
    """
    The change is safe and does not break existing clients.
    """
    SAFE @tag(name: "public")
    """
    The change might break existing clients that do not follow
    best-practises such as future-proof enums or future-proof interface/union type usages.
    """
    DANGEROUS @tag(name: "public")
    """
    The change will definetly break GraphQL client users.
    """
    BREAKING @tag(name: "public")
  }

  """
  Describes a schema change for either a schema version ('SchemaVersion') or schema check ('SchemaCheck').
  """
  type SchemaChange {
    criticality: CriticalityLevel!
      @deprecated(
        reason: "Use 'SchemaChange.severityLevel' instead. This field will be removed once it is no longer in use by a client."
      )
    criticalityReason: String
      @deprecated(
        reason: "Use 'SchemaChange.severityReason' instead. This field will be removed once it is no longer in use by a client."
      )
    """
    The severity level of this schema change.
    Note: A schema change with the impact 'SeverityLevelType.BREAKING' can still be safe based on the usage ('SchemaChange.isSafeBasedOnUsage').
    """
    severityLevel: SeverityLevelType! @tag(name: "public")
    """
    The reason for the schema changes severity level ('SchemaChange.severityLevel')
    """
    severityReason: String @tag(name: "public")
    """
    Message describing the schema change.
    """
    message(
      """
      Whether to include a note about the safety of the change based on usage data within the message.
      """
      withSafeBasedOnUsageNote: Boolean = true
    ): String! @tag(name: "public")
    path: [String!]
    """
    Approval metadata for this schema change.
    This field is populated in case the breaking change was manually approved.
    """
    approval: SchemaChangeApproval
    """
    Whether the breaking change is safe based on usage data.
    """
    isSafeBasedOnUsage: Boolean! @tag(name: "public")
    """
    Usage statistics about the schema change if it is not safe based on usage.
    The statistics are determined based on the breaking change configuration.
    The usage statistics are only available for breaking changes and only represent a snapshot of the usage data at the time of the schema check/schema publish.
    """
    usageStatistics: SchemaChangeUsageStatistics @tag(name: "public")
    """
    List of active app deployments that would be affected by this breaking change.
    Only populated for breaking changes when app deployments are enabled.
    """
    affectedAppDeployments(
      first: Int
      after: String
      firstOperations: Int
    ): SchemaChangeAffectedAppDeploymentsConnection @tag(name: "public")
  }

  type SchemaChangeAffectedAppDeploymentsConnection {
    edges: [SchemaChangeAffectedAppDeploymentEdge!]! @tag(name: "public")
    totalCount: Int! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type SchemaChangeAffectedAppDeploymentEdge {
    cursor: String! @tag(name: "public")
    node: SchemaChangeAffectedAppDeployment! @tag(name: "public")
  }

  type SchemaChangeUsageStatistics {
    """
    List of the top operations that are affected by this schema change.
    """
    topAffectedOperations: [SchemaChangeUsageStatisticsAffectedOperation!]! @tag(name: "public")
    """
    List of top clients that are affected by this schema change.
    """
    topAffectedClients: [SchemaChangeUsageStatisticsAffectedClient!]! @tag(name: "public")
  }

  type SchemaChangeUsageStatisticsAffectedOperation {
    """
    Name of the operation.
    """
    name: String! @tag(name: "public")
    """
    Hash of the operation.
    """
    hash: String! @tag(name: "public")
    """
    The number of times the operation was called in the period.
    """
    count: Float! @tag(name: "public")
    """
    Human readable count value.
    """
    countFormatted: String!
    """
    The percentage share of the operation of the total traffic.
    """
    percentage: Float! @tag(name: "public")
    """
    Human readable percentage value.
    """
    percentageFormatted: String!
  }

  type SchemaChangeUsageStatisticsAffectedClient {
    """
    Name of the client.
    """
    name: String! @tag(name: "public")
    """
    The number of times the client called the operation in the period.
    """
    count: Float! @tag(name: "public")
    """
    Human readable count value.
    """
    countFormatted: String!
    """
    The percentage share of the client of the total traffic.
    """
    percentage: Float! @tag(name: "public")
    """
    Human readable percentage value.
    """
    percentageFormatted: String!
  }

  """
  An app deployment that is affected by a breaking schema change.
  """
  type SchemaChangeAffectedAppDeployment {
    """
    The unique identifier of the app deployment.
    """
    id: ID! @tag(name: "public")
    """
    The name of the app deployment.
    """
    name: String! @tag(name: "public")
    """
    The version of the app deployment.
    """
    version: String! @tag(name: "public")
    """
    The timestamp when the app deployment was created.
    """
    createdAt: DateTime @tag(name: "public")
    """
    The timestamp when the app deployment was activated.
    """
    activatedAt: DateTime @tag(name: "public")
    """
    The current status of the app deployment.
    """
    status: AppDeploymentStatus!
    """
    The timestamp when the app deployment was retired. Only present for retired deployments.
    """
    retiredAt: DateTime @tag(name: "public")
    """
    The last time a GraphQL request that used the app deployment was reported.
    """
    lastUsed: DateTime @tag(name: "public")
    """
    The operations within this app deployment that use the affected schema coordinate.
    """
    affectedOperations(
      first: Int
      after: String
    ): SchemaChangeAffectedAppDeploymentOperationsConnection! @tag(name: "public")
    """
    Total count of operations within this app deployment that use the affected schema coordinate.
    """
    totalAffectedOperations: Int! @tag(name: "public")
  }

  type SchemaChangeAffectedAppDeploymentOperationsConnection {
    edges: [SchemaChangeAffectedAppDeploymentOperationEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type SchemaChangeAffectedAppDeploymentOperationEdge {
    cursor: String! @tag(name: "public")
    node: SchemaChangeAffectedAppDeploymentOperation! @tag(name: "public")
  }

  """
  An operation within an app deployment that is affected by a breaking schema change.
  """
  type SchemaChangeAffectedAppDeploymentOperation {
    """
    The hash of the operation document.
    """
    hash: String! @tag(name: "public")
    """
    The name of the operation (if named).
    """
    name: String @tag(name: "public")
  }

  type SchemaChangeApproval {
    """
    User that approved this schema change.
    """
    approvedBy: User
    """
    CLI approval metadata when approved via CLI (mutually exclusive with approvedBy).
    """
    cliApprovalMetadata: CLIApprovalMetadata
    """
    Date of the schema change approval.
    """
    approvedAt: DateTime!
    """
    ID of the schema check in which this change was first approved.
    """
    schemaCheckId: ID!
  }

  """
  Metadata for approvals made via CLI.
  """
  type CLIApprovalMetadata {
    """
    Raw author string from the CLI.
    """
    author: String!
    """
    Parsed display name from the author string.
    """
    displayName: String!
    """
    Parsed email from the author string (if available).
    """
    email: String
  }

  type SchemaError {
    message: String! @tag(name: "public")
    path: [String!]
  }

  type SchemaChangeConnection {
    nodes: [SchemaChange!]! @deprecated(reason: "Use 'SchemaChangeConnection.edges' instead.")
    total: Int! @deprecated(reason: "This field will be removed in the future.")
    edges: [SchemaChangeEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type SchemaChangeEdge {
    cursor: String! @tag(name: "public")
    node: SchemaChange! @tag(name: "public")
  }

  type SchemaErrorConnection {
    nodes: [SchemaError!]! @deprecated(reason: "Use 'SchemaErrorConnection.edges' instead.")
    total: Int! @deprecated(reason: "This field will be removed in the future.")
    edges: [SchemaErrorEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type SchemaErrorEdge {
    cursor: String! @tag(name: "public")
    node: SchemaError! @tag(name: "public")
  }

  type SchemaWarningConnection {
    nodes: [SchemaCheckWarning!]!
    total: Int!
  }

  type BreakingChangeMetadataTarget {
    slug: String! @tag(name: "public")
    id: ID! @tag(name: "public")
    target: Target @tag(name: "public")
  }

  type SchemaCheckConditionalBreakingChangeMetadataSettings {
    retentionInDays: Int! @tag(name: "public")
    percentage: Float! @tag(name: "public")
    excludedClientNames: [String!] @tag(name: "public")
    excludedAppDeploymentNames: [String!] @tag(name: "public")
    targets: [BreakingChangeMetadataTarget!]! @tag(name: "public")
  }

  type SchemaCheckConditionalBreakingChangeMetadataUsage {
    """
    Total amount of requests for the settings and period.
    """
    totalRequestCount: Float! @tag(name: "public")
    """
    Total request count human readable.
    """
    totalRequestCountFormatted: String!
  }

  type SchemaCheckConditionalBreakingChangeMetadata {
    period: DateRange! @tag(name: "public")
    settings: SchemaCheckConditionalBreakingChangeMetadataSettings!
    usage: SchemaCheckConditionalBreakingChangeMetadataUsage! @tag(name: "public")
  }

  type SchemaCheckSuccess {
    valid: Boolean!
    initial: Boolean!
    changes: SchemaChangeConnection
    """
    If the check is associated with a schema proposal, then this contains an unfiltered list of changes
    to the SDL.
    """
    schemaProposalChanges: SchemaChangeConnection
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
    """
    If the check is associated with a schema proposal, then this contains an unfiltered list of changes
    to the SDL.
    """
    schemaProposalChanges: SchemaChangeConnection
    changes: SchemaChangeConnection
    errors: SchemaErrorConnection!
    warnings: SchemaWarningConnection
    schemaCheck: SchemaCheck
  }

  type GitHubSchemaCheckSuccess {
    message: String!
    """
    Whether the schema check passed. The same result is reported on the GitHub check-run.
    """
    isValid: Boolean!
    """
    The schema check that was stored for this check.
    """
    schemaCheck: SchemaCheck
  }

  type GitHubSchemaCheckError {
    message: String!
  }

  type GitHubSchemaPublishSuccess {
    message: String!
    """
    Whether the registry accepted the schema, like SchemaPublishSuccess.
    False means the publish was rejected and nothing was stored, like SchemaPublishError.
    """
    isValid: Boolean!
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

  type SchemaPublishRetry {
    reason: String!
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

  input SchemaCheckBaselineInput {
    """
    The service schema SDL.
    """
    sdl: String!
    """
    An identifier for the supplied baseline schema, e.g. a Git SHA
    """
    hash: String
  }

  input SchemaCheckInput {
    target: TargetReferenceInput
    service: ID
    """
    The schema SDL after applying the proposed change.
    """
    sdl: String!

    """
    The baseline service SDL before applying the proposed changes.

    When provided for a distributed schema, Hive composes this service SDL
    with the other services currently stored in the registry and compares
    that composition against the composition produced from 'SchemaCheckInput.sdl'.

    Intended for checks where the comparison baseline differs from the
    latest schema stored in the registry, such as GitHub Merge Queue builds.
    """
    baseline: SchemaCheckBaselineInput = null

    github: GitHubSchemaCheckInput
    meta: SchemaCheckMetaInput
    """
    Optional context ID to group schema checks together.
    Manually approved breaking changes will be memorized for schema checks with the same context id.
    """
    contextId: String
    """
    Optional url if wanting to show subgraph url changes inside checks.
    """
    url: String

    """
    Optional. Attaches the check to a schema proposal.
    """
    schemaProposalId: ID
  }

  input SchemaDeleteInput {
    target: TargetReferenceInput
    serviceName: ID!
    dryRun: Boolean
    """
    Whether the client supports retries in case the registry is busy and the operation could not be performed.
    """
    supportsRetry: Boolean = false
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
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    after: ID!
    before: ID!
  }

  input SchemaVersionUpdateInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    versionId: ID!
    valid: Boolean!
  }

  input UpdateBaseSchemaInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    newBase: String
  }

  type ContractVersionEdge {
    node: ContractVersion! @tag(name: "public")
    cursor: String! @tag(name: "public")
  }

  type ContractVersionConnection {
    edges: [ContractVersionEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  input SchemaExplorerPeriodInput @oneOf {
    """
    A full range using a start and end date.
    """
    absoluteRange: DateRangeInput @tag(name: "public")
  }

  type SchemaVersion {
    id: ID! @tag(name: "public")
    """
    A schema version is valid if the composition and contract compositions are successful.
    """
    valid: Boolean! @deprecated(reason: "Use 'SchemaVersion.isValid' instead.")
    """
    A schema version is valid if the composition and contract compositions are successful.
    """
    isValid: Boolean! @tag(name: "public")
    """
    Whether this schema version is composable.
    """
    isComposable: Boolean!
    """
    Whether this schema version has schema changes.
    """
    hasSchemaChanges: Boolean!
    """
    The date on which this schema version was published.
    """
    date: DateTime! @tag(name: "public")
    """
    The log that initiated this schema version.
    For a federation schema this is the published or removed subgraph/service.
    """
    log: RegistryLog!
      @tag(name: "public")
      @deprecated(reason: "Please use 'SchemaVersion.origin' instead.")
    baseSchema: String
    """
    The schemas that are composed within this schema version.
    For federation these are the subgraphs/services.
    """
    schemas: SchemaConnection! @tag(name: "public")
    """
    Lowercased, sorted names of the services published in this version.
    Null for single-schema projects.
    """
    serviceNames: [String!]
    """
    The supergraph SDL for a federation schema.
    """
    supergraph: String @tag(name: "public")
    """
    The (public) schema SDL.
    """
    sdl: String @tag(name: "public")
    """
    List of tags in the schema version. E.g. when using Federation.
    Tags can be used for filtering the schema via contracts.
    """
    tags: [String!]
    """
    Experimental: This field is not stable and may change in the future.
    """
    explorer(usage: SchemaExplorerUsageInput): SchemaExplorer
    """
    An overview of unused fields and their types within the GraphQL schema.
    """
    unusedSchema(
      """
      The period to use in order to determind whether a field is unused.
      A field is unused if it has not been requested within the specified period.

      Defaults to the last 30 days, capped at the organization's usage retention.
      """
      period: SchemaExplorerPeriodInput @tag(name: "public")
    ): UnusedSchemaExplorer @tag(name: "public")
    """
    An overview of deprecated fields and types with their usage in the GraphQL schema.
    """
    deprecatedSchema(
      """
      The period for which the usage data should be included within the result.

      Defaults to the last 30 days, capped at the organization's usage retention.
      """
      period: SchemaExplorerPeriodInput @tag(name: "public")
    ): DeprecatedSchemaExplorer @tag(name: "public")

    schemaCompositionErrors: SchemaErrorConnection @tag(name: "public")

    """
    Schema changes that were introduced in this schema version (compared to the previous version).
    """
    schemaChanges: SchemaChangeConnection @tag(name: "public")
    """
    A list of the supergraph changes.
    """
    supergraphChanges: SchemaChangeConnection

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
    contractVersions: ContractVersionConnection @tag(name: "public")

    """
    The diffs of the individual services compared to the latest version.
    This is only available for non monolithic projects.
    """
    subgraphDiffs: [SubgraphDiff!]
    origin: SchemaVersionOrigin! @tag(name: "public")
    """
    Additional metadata associated with the schema version that help identifying it.
    """
    meta: SchemaVersionMeta
  }

  type SchemaVersionMeta {
    """
    The author of the schema version
    """
    author: String
    """
    A user associated string that helps identifying the schema version.
    """
    commit: String
  }

  type SchemaVersionGithubMetadata {
    repository: String!
    commit: String!
  }

  type SchemaVersionEdge {
    node: SchemaVersion! @tag(name: "public")
    cursor: String! @tag(name: "public")
  }

  type SchemaVersionConnection {
    edges: [SchemaVersionEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  input SchemaExplorerUsageInput {
    period: DateRangeInput!
  }

  type MetadataAttribute {
    name: String!
    values: [String!]!
  }

  type SchemaExplorer {
    metadataAttributes: [MetadataAttribute!]
    subgraphNames: [String!]!
    types: [GraphQLNamedType!]!
    type(name: String!): GraphQLNamedType
    query: GraphQLObjectType
    mutation: GraphQLObjectType
    subscription: GraphQLObjectType
  }

  extend type SchemaCoordinateStats {
    # If associated with a federated project, this contains the metadata for this coordinate.
    supergraphMetadata: SupergraphMetadata
  }

  """
  Explorer for navigating unused schema parts within the contextual provided period.
  """
  type UnusedSchemaExplorer {
    """
    The affected unused types and their fields/values/members etc.

    The types within the result only contain unused fields/values/members, all other entities are excluded,
    they are not a representation of the full GraphQL schema.
    """
    types: [GraphQLNamedType!]! @tag(name: "public")
  }

  """
  Explorer for navigating the deprecated schema parts with usage data provided by the contextual period.
  """
  type DeprecatedSchemaExplorer {
    """
    The affected types whose fields/values/members are deprecated.

    The types within the result only contain deprecated fields/values/members, all other entities are excluded,
    they are not a representation of the full GraphQL schema.
    """
    types: [GraphQLNamedType!]! @tag(name: "public")
  }

  """
  Information about the schema coordinate usage within the contextual period.
  """
  type SchemaCoordinateUsage @tag(name: "public") {
    """
    The total amount of usages of the schema coordinate within the contextual period.
    """
    total: Float!

    """
    The total amount of resolutions of the schema coordinate within the contextual period.
    """
    totalResolutions: SafeInt

    """
    The total amount of errors of the schema coordinate within the contextual period.
    """
    errorTotal: SafeInt
    """
    Whether the schema coordinate is used within the contextual period.
    """
    isUsed: Boolean!
    """
    A list of clients that use this schema coordinate within GraphQL operation documents.
    Is null if used by none clients.
    """
    usedByClients: [String!]
    """
    The top operations executed for this schema coordinate within the contextual period.
    """
    topOperations(limit: Int!): [SchemaCoordinateUsageOperation!]!
  }

  type SchemaCoordinateUsageOperation @tag(name: "public") {
    """
    The name of the GraphQL operation.
    """
    name: String!
    """
    The hash of the GraphQL operation
    """
    hash: String!
    """
    The number of times the operation was called within the contextual period.
    """
    count: Float!
  }

  type SupergraphMetadata {
    metadata: [SchemaMetadata!]
    """
    List of service names that own the field/type.
    Resolves to null if the entity (field, type, scalar) does not belong to any service.
    """
    ownedByServiceNames: [String!] @tag(name: "public")
  }

  type SchemaMetadata {
    """
    The name or key of the metadata. This may not be unique.
    """
    name: String!
    """
    The value of the metadata
    """
    content: String!
    """
    The schema or subgraph name where this metadata originated from.
    """
    source: String
  }

  interface GraphQLNamedType @tag(name: "public") {
    """
    The name of the GraphQL type.
    """
    name: String!
    """
    The description of the GraphQL type.
    """
    description: String
    """
    The usage of the type within the specified period.
    """
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLObjectType implements GraphQLNamedType @tag(name: "public") {
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

  type GraphQLInterfaceType implements GraphQLNamedType @tag(name: "public") {
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

  type GraphQLUnionType implements GraphQLNamedType @tag(name: "public") {
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

  type GraphQLUnionTypeMember @tag(name: "public") {
    name: String!
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLEnumType implements GraphQLNamedType @tag(name: "public") {
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

  type GraphQLInputObjectType implements GraphQLNamedType @tag(name: "public") {
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

  type GraphQLScalarType implements GraphQLNamedType @tag(name: "public") {
    name: String!
    description: String
    usage: SchemaCoordinateUsage!
    """
    Metadata specific to Apollo Federation Projects.
    Is null if no meta information is available (e.g. this is not an apollo federation project).
    """
    supergraphMetadata: SupergraphMetadata
  }

  type GraphQLField @tag(name: "public") {
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

  type GraphQLInputField @tag(name: "public") {
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

  type GraphQLArgument @tag(name: "public") {
    name: String!
    description: String
    type: String!
    defaultValue: String
    isDeprecated: Boolean!
    deprecationReason: String
    usage: SchemaCoordinateUsage!
  }

  type GraphQLEnumValue @tag(name: "public") {
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
    author: String! @tag(name: "public")
    commit: String! @tag(name: "public")
  }

  interface SchemaCheck {
    id: ID! @tag(name: "public")
    createdAt: String! @tag(name: "public")
    """
    Optional context ID to group schema checks together.
    """
    contextId: String
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String! @tag(name: "public")
    """
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
      @tag(name: "public")
      @deprecated(reason: "Please use the 'SchemaCheck.baseline' field instead.")
    """
    The schema used as the baseline for this check.
    """
    baseline: SchemaCheckBaseline
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String @tag(name: "public")
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta @tag(name: "public")
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion @tag(name: "public")
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String @tag(name: "public")
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
    If the check is associated with a schema proposal, then this contains an unfiltered list of changes
    to the SDL.
    """
    schemaProposalChanges: SchemaChangeConnection

    schemaChanges: SchemaChangeConnection @tag(name: "public")
    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    schemaPolicyErrors: SchemaPolicyWarningConnection
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection @tag(name: "public")
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata
      @tag(name: "public")
  }

  """
  The contract schema used as the baseline for this check.
  """
  type ContractCheckBaseline {
    """
    The supergraph SDL of the baseline contract schema, if composition succeeded.
    """
    supergraphSdl: String
    """
    The public SDL of the baseline contract schema, if composition succeeded.
    """
    publicSdl: String
    """
    Composition errors produced by the baseline contract schema.
    """
    compositionErrors: [SchemaError!]
  }

  """
  Schema check result for contracts
  """
  type ContractCheck {
    id: ID!
    contractName: String! @tag(name: "public")

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

    schemaCompositionErrors: SchemaErrorConnection @tag(name: "public")

    schemaChanges: SchemaChangeConnection @tag(name: "public")

    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection

    compositeSchemaSDL: String @tag(name: "public")
    supergraphSDL: String @tag(name: "public")

    isSuccess: Boolean! @tag(name: "public")

    """
    The contract version against this check was performed.
    """
    contractVersion: ContractVersion @tag(name: "public")

    """
    The contract schema used as the baseline for this check.
    """
    baseline: ContractCheckBaseline
  }

  type ContractCheckEdge {
    cursor: String! @tag(name: "public")
    node: ContractCheck! @tag(name: "public")
  }

  type ContractCheckConnection {
    edges: [ContractCheckEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type ContractVersion {
    id: ID!
    createdAt: String!
    contractName: String! @tag(name: "public")

    """
    Whether this contract version is composable.
    """
    isComposable: Boolean! @tag(name: "public")
    schemaCompositionErrors: SchemaErrorConnection @tag(name: "public")

    supergraphSDL: String @tag(name: "public")
    compositeSchemaSDL: String @tag(name: "public")
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

    schemaChanges: SchemaChangeConnection @tag(name: "public")

    previousContractVersion: ContractVersion @tag(name: "public")
    previousDiffableContractVersion: ContractVersion @tag(name: "public")

    isFirstComposableVersion: Boolean!
  }

  """
  Metadata associated with a schema check baseline.
  """
  type SchemaCheckBaselineMeta {
    """
    The caller-supplied identifier for the baseline, such as a Git commit SHA.
    """
    commit: String
  }

  """
  The schema used as the baseline for a schema check.
  """
  type SchemaCheckBaseline {
    """
    The service SDL of the baseline schema.
    """
    sdl: String
    """
    The supergraph SDL of the baseline schema, if composition succeeded.
    """
    supergraphSdl: String
    """
    The public SDL of the baseline schema, if composition succeeded.
    """
    publicSdl: String
    """
    Composition errors produced by the baseline schema.
    """
    compositionErrors: [SchemaError!]

    """
    Metadata associated with the baseline schema.
    """
    meta: SchemaCheckBaselineMeta!
  }

  """
  A successful schema check.
  """
  type SuccessfulSchemaCheck implements SchemaCheck {
    id: ID! @tag(name: "public")
    createdAt: String! @tag(name: "public")
    """
    Optional context ID to group schema checks together.
    """
    contextId: String
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String! @tag(name: "public")
    """
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
      @tag(name: "public")
      @deprecated(reason: "Please use the 'SchemaCheck.baseline' field instead.")
    """
    The schema used as the baseline for this check.
    """
    baseline: SchemaCheckBaseline
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String @tag(name: "public")
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta @tag(name: "public")
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion @tag(name: "public")
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String @tag(name: "public")
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
    If the check is associated with a schema proposal, then this contains an unfiltered list of changes
    to the SDL.
    """
    schemaProposalChanges: SchemaChangeConnection

    schemaChanges: SchemaChangeConnection @tag(name: "public")
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

    compositeSchemaSDL: String @tag(name: "public")
    supergraphSDL: String @tag(name: "public")
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection @tag(name: "public")
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata
      @tag(name: "public")

    """
    Whether the schema check was manually approved.
    """
    isApproved: Boolean!
    """
    The user that approved the schema check.
    """
    approvedBy: User
    """
    CLI approval metadata when approved via CLI (mutually exclusive with approvedBy).
    """
    cliApprovalMetadata: CLIApprovalMetadata
    """
    Comment given when the schema check was approved.
    """
    approvalComment: String
  }

  """
  A failed schema check.
  """
  type FailedSchemaCheck implements SchemaCheck {
    id: ID! @tag(name: "public")
    createdAt: String! @tag(name: "public")
    """
    Optional context ID to group schema checks together.
    """
    contextId: String
    """
    The SDL of the schema that was checked.
    """
    schemaSDL: String! @tag(name: "public")
    """
    The previous schema SDL. For composite schemas this is the service.
    """
    previousSchemaSDL: String
      @tag(name: "public")
      @deprecated(reason: "Please use the 'SchemaCheck.baseline' field instead.")
    """
    The schema used as the baseline for this check.
    """
    baseline: SchemaCheckBaseline
    """
    The name of the service that owns the schema. Is null for non composite project types.
    """
    serviceName: String @tag(name: "public")
    """
    Meta information about the schema check.
    """
    meta: SchemaCheckMeta @tag(name: "public")
    """
    The schema version against this check was performed.
    Is null if there is no schema version published yet.
    """
    schemaVersion: SchemaVersion @tag(name: "public")
    """
    The URL of the schema check on the Hive Web App.
    """
    webUrl: String @tag(name: "public")
    """
    The GitHub repository associated with the schema check.
    """
    githubRepository: String

    compositionErrors: SchemaErrorConnection @tag(name: "public")

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
    If the check is associated with a schema proposal, then this contains an unfiltered list of changes
    to the SDL.
    """
    schemaProposalChanges: SchemaChangeConnection

    schemaChanges: SchemaChangeConnection @tag(name: "public")
    breakingSchemaChanges: SchemaChangeConnection
    safeSchemaChanges: SchemaChangeConnection
    schemaPolicyWarnings: SchemaPolicyWarningConnection
    schemaPolicyErrors: SchemaPolicyWarningConnection

    compositeSchemaSDL: String @tag(name: "public")
    supergraphSDL: String @tag(name: "public")
    """
    Results of the contracts
    """
    contractChecks: ContractCheckConnection @tag(name: "public")
    """
    Conditional breaking change metadata.
    """
    conditionalBreakingChangeMetadata: SchemaCheckConditionalBreakingChangeMetadata
      @tag(name: "public")

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
    node: SchemaCheck! @tag(name: "public")
    cursor: String! @tag(name: "public")
  }

  type SchemaCheckConnection {
    edges: [SchemaCheckEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  type ContractEdge {
    node: Contract! @tag(name: "public")
    cursor: String! @tag(name: "public")
  }

  type ContractConnection {
    edges: [ContractEdge!]! @tag(name: "public")
    pageInfo: PageInfo! @tag(name: "public")
  }

  input ApproveFailedSchemaCheckInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    schemaCheckId: ID!
    """
    Optional comment visible in the schema check.
    Give a reason why the schema check was approved.
    """
    comment: String
    author: String
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

  input ContractReferenceInput @oneOf {
    byId: ID @tag(name: "public")
  }

  input CreateContractInput {
    target: TargetReferenceInput! @tag(name: "public")
    contractName: String! @tag(name: "public")
    includeTags: [String!] @tag(name: "public")
    excludeTags: [String!] @tag(name: "public")
    removeUnreachableTypesFromPublicApiSchema: Boolean! @tag(name: "public")
  }

  type CreateContractResult {
    ok: CreateContractResultOk @tag(name: "public")
    error: CreateContractResultError @tag(name: "public")
  }

  type CreateContractResultOk {
    createdContract: Contract! @tag(name: "public")
  }

  type CreateContractResultError {
    message: String! @tag(name: "public")
    details: CreateContractInputErrors! @tag(name: "public")
  }

  type CreateContractInputErrors {
    target: String @tag(name: "public")
    contractName: String @tag(name: "public")
    includeTags: String @tag(name: "public")
    excludeTags: String @tag(name: "public")
  }

  input DeleteContractInput {
    contract: ContractReferenceInput! @tag(name: "public")
  }

  type DeleteContractResult {
    ok: DeleteContractResultOk @tag(name: "public")
    error: DeleteContractResultError @tag(name: "public")
  }

  type DeleteContractResultOk {
    deletedContractId: ID! @tag(name: "public")
  }

  type DeleteContractResultError {
    message: String! @tag(name: "public")
  }

  type Contract {
    id: ID! @tag(name: "public")
    target: Target!
    contractName: String! @tag(name: "public")
    includeTags: [String!] @tag(name: "public")
    excludeTags: [String!] @tag(name: "public")
    removeUnreachableTypesFromPublicApiSchema: Boolean! @tag(name: "public")
    createdAt: DateTime! @tag(name: "public")
    viewerCanDeleteContract: Boolean!
  }

  type SubgraphVersion {
    """
    The ID of the subgraph.
    """
    id: ID!
    """
    The user-provided immutable revision for this subgraph version, if any.
    """
    revision: String
    """
    The service name.
    """
    serviceName: String!
    """
    The subgraph SDL.
    """
    sdl: String!
    """
    The URL of the Subgraph.
    """
    url: String!
  }

  """
  Describes the difference from one subgraph version to the next one.
  """
  union SubgraphDiff =
    | SubgraphDiffChanged
    | SubgraphDiffRemoved
    | SubgraphDiffUnchanged
    | SubgraphDiffAdded

  """
  The subgraph was newly added and did not exist before in the supergraph.
  """
  type SubgraphDiffAdded {
    """
    The added subgraph version.
    """
    subgraphVersion: SubgraphVersion!
  }

  """
  The subgraph was updated to a new version.
  """
  type SubgraphDiffChanged {
    """
    The current subgraph version.
    """
    subgraphVersion: SubgraphVersion!
    """
    The previous subgraph version.
    """
    previousSubgraphVersion: SubgraphVersion!
    """
    The changes from one to the next subgraph version.
    """
    changes: SchemaChangeConnection
  }

  """
  The subgraph was removed from the supergraph.
  """
  type SubgraphDiffRemoved {
    """
    The subgraph version that was removed.
    """
    removedSubgraphVersion: SubgraphVersion!
  }

  """
  The subgraph is unchanged in this version.
  """
  type SubgraphDiffUnchanged {
    """
    The current subgraph version.
    """
    subgraphVersion: SubgraphVersion!
  }

  """
  Describes the action that caused the creation of a new SchemaVersion.
  """
  union SchemaVersionOrigin @tag(name: "public") =
    | SchemaVersionPublishOrigin
    | SchemaVersionSubgraphRemoveOrigin
    | SchemaVersionPromoteOrigin

  type SchemaVersionPromoteOrigin {
    """
    The ID of the target from which the promotion originated.
    """
    targetId: ID! @tag(name: "public")
    """
    The slug of the target from which the promotion originated.
    """
    targetSlug: String!
    """
    The exact ID of the schema version that was promoted from within the target.
    """
    schemaVersionId: ID! @tag(name: "public")
  }

  type SubgraphOriginSubgraphReference {
    name: String! @tag(name: "public")
    versionId: ID! @tag(name: "public")
    """
    The user-provided immutable revision used for this publish, if any.
    """
    revision: String
  }

  type SchemaVersionSubgraphRemoveOrigin {
    """
    The subgraphs that were removed in this version.
    """
    removedSubgraphs: [SubgraphOriginSubgraphReference!]! @tag(name: "public")
  }

  type SchemaVersionPublishOrigin {
    """
    The user-provided immutable revision used for a monolith publish, if any.
    """
    revision: String

    """
    The subgraphs published as part of this version.
    This value is 'null' for non-federation projects.
    """
    publishedSubgraphs: [SubgraphOriginSubgraphReference!] @tag(name: "public")
  }

  input SchemaVersionPromoteTargetInput @oneOf {
    toTarget: TargetReferenceInput
  }

  input SchemaVersionPromoteSourceInput @oneOf {
    """
    The latest version within the target should be promoted.
    """
    fromTarget: TargetReferenceInput
    """
    A specific version should be promoted.
    """
    fromSchemaVersionById: ID
  }

  """
  Input for a schema version promotion.
  Both the source and target must be within the same project.
  """
  input SchemaVersionPromoteInput {
    """
    The source of the schema promotion.
    This can either be a target or a specific schema version.
    """
    source: SchemaVersionPromoteSourceInput!
    """
    Where the schema version should be promoted to.
    """
    target: SchemaVersionPromoteTargetInput!
  }

  type SchemaVersionPromoteResultOk {
    """
    The new schema version that was created via the promotion.
    """
    newSchemaVersion: SchemaVersion!
    """
    The link for viewing the new schema version on the Hive Console dashboard.
    """
    linkToWebsite: String
  }

  type SchemaVersionPromoteResultError {
    message: String!
  }

  type SchemaVersionPromoteResult {
    ok: SchemaVersionPromoteResultOk
    error: SchemaVersionPromoteResultError
  }
`;
