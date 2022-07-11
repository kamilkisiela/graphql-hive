import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    organization(selector: OrganizationSelectorInput!): OrganizationPayload
    organizationByInviteCode(code: String!): OrganizationByInviteCodePayload
    organizations: OrganizationConnection!
  }

  extend type Mutation {
    createOrganization(input: CreateOrganizationInput!): CreateOrganizationResult!
    deleteOrganization(selector: OrganizationSelectorInput!): OrganizationPayload!
    deleteOrganizationMembers(selector: OrganizationMembersSelectorInput!): OrganizationPayload!
    joinOrganization(code: String!): JoinOrganizationPayload!
    resetInviteCode(selector: OrganizationSelectorInput!): OrganizationPayload!
    updateOrganizationName(input: UpdateOrganizationNameInput!): UpdateOrganizationNameResult!
    updateOrganizationMemberAccess(input: OrganizationMemberAccessInput!): OrganizationPayload!
  }

  type UpdateOrganizationNameResult {
    ok: UpdateOrganizationNameOk
    error: UpdateOrganizationNameError
  }

  type UpdateOrganizationNameOk {
    updatedOrganizationPayload: OrganizationPayload!
  }
  type UpdateOrganizationNameError implements Error {
    message: String!
  }

  type CreateOrganizationOk {
    createdOrganizationPayload: OrganizationPayload!
  }

  type CreateOrganizationInputErrors {
    name: String
  }

  type CreateOrganizationError implements Error {
    message: String!
    inputErrors: CreateOrganizationInputErrors!
  }

  type CreateOrganizationResult {
    ok: CreateOrganizationOk
    error: CreateOrganizationError
  }

  input OrganizationSelectorInput {
    organization: ID!
  }

  type OrganizationSelector {
    organization: ID!
  }

  input OrganizationMembersSelectorInput {
    organization: ID!
    users: [ID!]!
  }

  input OrganizationMemberAccessInput {
    organization: ID!
    user: ID!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
  }

  input CreateOrganizationInput {
    name: String!
  }

  input UpdateOrganizationNameInput {
    organization: ID!
    name: String!
  }

  enum OrganizationType {
    PERSONAL
    REGULAR
  }

  type Organization {
    id: ID!
    cleanId: ID!
    name: String!
    type: OrganizationType!
    owner: Member!
    me: Member!
    members: MemberConnection!
    inviteCode: String!
    getStarted: OrganizationGetStarted!
  }

  type OrganizationConnection {
    nodes: [Organization!]!
    total: Int!
  }

  type OrganizationInvitationError {
    message: String!
  }

  type OrganizationInvitationPayload {
    name: String!
  }

  union JoinOrganizationPayload = OrganizationInvitationError | OrganizationPayload

  union OrganizationByInviteCodePayload = OrganizationInvitationError | OrganizationInvitationPayload

  type OrganizationPayload {
    selector: OrganizationSelector!
    organization: Organization!
  }

  type OrganizationGetStarted {
    creatingProject: Boolean!
    publishingSchema: Boolean!
    checkingSchema: Boolean!
    invitingMembers: Boolean!
    enablingUsageBasedBreakingChanges: Boolean!
  }
`;
