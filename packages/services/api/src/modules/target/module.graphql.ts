import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    target(selector: TargetSelectorInput!): Target
    targets(selector: ProjectSelectorInput!): TargetConnection!
  }

  extend type Mutation {
    createTarget(input: CreateTargetInput!): CreateTargetResult!
    updateTargetSlug(input: UpdateTargetSlugInput!): UpdateTargetSlugResult!
    deleteTarget(selector: TargetSelectorInput!): DeleteTargetPayload!
    updateTargetValidationSettings(
      input: UpdateTargetValidationSettingsInput!
    ): UpdateTargetValidationSettingsResult!
    setTargetValidation(input: SetTargetValidationInput!): Target!
    """
    Updates the target's explorer endpoint url.
    """
    updateTargetGraphQLEndpointUrl(
      input: UpdateTargetGraphQLEndpointUrlInput!
    ): UpdateTargetGraphQLEndpointUrlResult!
    """
    Overwrites project's schema composition library.
    Works only for Federation projects with native composition enabled.
    This mutation is temporary and will be removed once no longer needed.
    It's part of a feature flag called "forceLegacyCompositionInTargets".
    """
    experimental__updateTargetSchemaComposition(
      input: Experimental__UpdateTargetSchemaCompositionInput!
    ): Target!
  }

  input Experimental__UpdateTargetSchemaCompositionInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    nativeComposition: Boolean!
  }

  input UpdateTargetGraphQLEndpointUrlInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    graphqlEndpointUrl: String
  }

  type UpdateTargetGraphQLEndpointUrlOk {
    target: Target!
  }

  type UpdateTargetGraphQLEndpointUrlError {
    message: String!
  }

  type UpdateTargetGraphQLEndpointUrlResult {
    ok: UpdateTargetGraphQLEndpointUrlOk
    error: UpdateTargetGraphQLEndpointUrlError
  }

  input UpdateTargetSlugInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    slug: String!
  }

  type UpdateTargetSlugResult {
    ok: UpdateTargetSlugOk
    error: UpdateTargetSlugError
  }

  type UpdateTargetSlugOk {
    selector: TargetSelector!
    target: Target!
  }

  type UpdateTargetSlugError implements Error {
    message: String!
  }

  type CreateTargetResult {
    ok: CreateTargetOk
    error: CreateTargetError
  }

  type CreateTargetInputErrors {
    slug: String
  }

  type CreateTargetError implements Error {
    message: String!
    inputErrors: CreateTargetInputErrors!
  }

  type CreateTargetOk {
    selector: TargetSelector!
    createdTarget: Target!
  }

  input TargetSelectorInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
  }

  input UpdateTargetValidationSettingsInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    period: Int!
    percentage: Float!
    targetIds: [ID!]!
    excludedClients: [String!]
  }

  type UpdateTargetValidationSettingsResult {
    ok: UpdateTargetValidationSettingsOk
    error: UpdateTargetValidationSettingsError
  }

  type UpdateTargetValidationSettingsInputErrors {
    percentage: String
    period: String
  }

  type UpdateTargetValidationSettingsError implements Error {
    message: String!
    inputErrors: UpdateTargetValidationSettingsInputErrors!
  }

  type UpdateTargetValidationSettingsOk {
    target: Target!
  }

  input SetTargetValidationInput {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
    enabled: Boolean!
  }

  type TargetSelector {
    organizationSlug: String!
    projectSlug: String!
    targetSlug: String!
  }

  extend type Project {
    targets: TargetConnection!
  }

  type TargetConnection {
    nodes: [Target!]!
    total: Int!
  }

  type Target {
    id: ID!
    slug: String!
    cleanId: ID! @deprecated(reason: "Use the 'slug' field instead.")
    name: String! @deprecated(reason: "Use the 'slug' field instead.")
    project: Project!
    """
    The endpoint url of the target's explorer instance.
    """
    graphqlEndpointUrl: String
    validationSettings: TargetValidationSettings!
    experimental_forcedLegacySchemaComposition: Boolean!
  }

  type TargetValidationSettings {
    enabled: Boolean!
    period: Int!
    percentage: Float!
    targets: [Target!]!
    excludedClients: [String!]!
  }

  input CreateTargetInput {
    organizationSlug: String!
    projectSlug: String!
    slug: String!
  }

  type DeleteTargetPayload {
    selector: TargetSelector!
    deletedTarget: Target!
  }
`;
