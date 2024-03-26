import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    organization(selector: OrganizationSelectorInput!): OrganizationPayload
    organizationByInviteCode(code: String!): OrganizationByInviteCodePayload
    organizations: OrganizationConnection!
    organizationTransferRequest(
      selector: OrganizationTransferRequestSelector!
    ): OrganizationTransfer
    myDefaultOrganization(previouslyVisitedOrganizationId: ID): OrganizationPayload
  }

  extend type Mutation {
    createOrganization(input: CreateOrganizationInput!): CreateOrganizationResult!
    deleteOrganization(selector: OrganizationSelectorInput!): OrganizationPayload!
    deleteOrganizationMember(input: OrganizationMemberInput!): OrganizationPayload!
    joinOrganization(code: String!): JoinOrganizationPayload!
    leaveOrganization(input: OrganizationSelectorInput!): LeaveOrganizationResult!
    inviteToOrganizationByEmail(
      input: InviteToOrganizationByEmailInput!
    ): InviteToOrganizationByEmailResult!
    deleteOrganizationInvitation(
      input: DeleteOrganizationInvitationInput!
    ): DeleteOrganizationInvitationResult!
    updateOrganizationName(input: UpdateOrganizationNameInput!): UpdateOrganizationNameResult!
    updateOrganizationMemberAccess(input: OrganizationMemberAccessInput!): OrganizationPayload!
    requestOrganizationTransfer(
      input: RequestOrganizationTransferInput!
    ): RequestOrganizationTransferResult!
    answerOrganizationTransferRequest(
      input: AnswerOrganizationTransferRequestInput!
    ): AnswerOrganizationTransferRequestResult!
    createMemberRole(input: CreateMemberRoleInput!): CreateMemberRoleResult!
    updateMemberRole(input: UpdateMemberRoleInput!): UpdateMemberRoleResult!
    deleteMemberRole(input: DeleteMemberRoleInput!): DeleteMemberRoleResult!
    assignMemberRole(input: AssignMemberRoleInput!): AssignMemberRoleResult!
    """
    Remove this mutation after migration is complete.
    """
    migrateUnassignedMembers(input: MigrateUnassignedMembersInput!): MigrateUnassignedMembersResult!
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

  """
  @oneOf
  """
  type LeaveOrganizationResult {
    ok: LeaveOrganizationOk
    error: LeaveOrganizationError
  }

  type LeaveOrganizationOk {
    organizationId: ID!
  }

  type LeaveOrganizationError implements Error {
    message: String!
  }

  input OrganizationTransferRequestSelector {
    organization: ID!
    code: String!
  }

  input AnswerOrganizationTransferRequestInput {
    organization: ID!
    accept: Boolean!
    code: String!
  }

  """
  @oneOf
  """
  type AnswerOrganizationTransferRequestResult {
    ok: AnswerOrganizationTransferRequestOk
    error: AnswerOrganizationTransferRequestError
  }

  type AnswerOrganizationTransferRequestOk {
    accepted: Boolean!
  }

  type AnswerOrganizationTransferRequestError implements Error {
    message: String!
  }

  """
  @oneOf
  """
  type RequestOrganizationTransferResult {
    ok: RequestOrganizationTransferOk
    error: RequestOrganizationTransferError
  }

  type RequestOrganizationTransferOk {
    email: String!
    code: String!
  }

  type RequestOrganizationTransferError implements Error {
    message: String!
  }

  """
  @oneOf
  """
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

  input OrganizationMemberInput {
    organization: ID!
    user: ID!
  }

  input OrganizationMemberAccessInput {
    organization: ID!
    user: ID!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
  }

  input RequestOrganizationTransferInput {
    organization: ID!
    user: ID!
  }

  input CreateOrganizationInput {
    name: String!
  }

  input UpdateOrganizationNameInput {
    organization: ID!
    name: String!
  }

  input InviteToOrganizationByEmailInput {
    organization: ID!
    role: ID
    email: String!
  }

  input DeleteOrganizationInvitationInput {
    organization: ID!
    email: String!
  }

  type InviteToOrganizationByEmailError implements Error {
    message: String!
    """
    The detailed validation error messages for the input fields.
    """
    inputErrors: InviteToOrganizationByEmailInputErrors!
  }

  type InviteToOrganizationByEmailInputErrors {
    email: String
  }

  """
  @oneOf
  """
  type InviteToOrganizationByEmailResult {
    ok: OrganizationInvitation
    error: InviteToOrganizationByEmailError
  }

  type OrganizationTransfer {
    organization: Organization!
  }

  type Organization {
    id: ID!
    cleanId: ID!
    name: String!
    owner: Member!
    me: Member!
    members: MemberConnection!
    invitations: OrganizationInvitationConnection!
    getStarted: OrganizationGetStarted!
    memberRoles: [MemberRole!]!
    """
    Only available to members with the Admin role.
    Returns a list of members that are not assigned to any role.
    """
    unassignedMembersToMigrate: [MemberRoleMigrationGroup!]!
  }

  type OrganizationConnection {
    nodes: [Organization!]!
    total: Int!
  }

  type OrganizationInvitationConnection {
    nodes: [OrganizationInvitation!]!
    total: Int!
  }

  type OrganizationInvitation {
    id: ID!
    createdAt: DateTime!
    expiresAt: DateTime!
    email: String!
    code: String!
    role: MemberRole!
  }

  type OrganizationInvitationError {
    message: String!
  }

  type OrganizationInvitationPayload {
    name: String!
  }

  union JoinOrganizationPayload = OrganizationInvitationError | OrganizationPayload

  union OrganizationByInviteCodePayload =
    | OrganizationInvitationError
    | OrganizationInvitationPayload

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

  """
  @oneOf
  """
  type DeleteOrganizationInvitationResult {
    ok: OrganizationInvitation
    error: DeleteOrganizationInvitationError
  }

  type DeleteOrganizationInvitationError implements Error {
    message: String!
  }

  extend type Member {
    canLeaveOrganization: Boolean!
    role: MemberRole
    isAdmin: Boolean!
  }

  type MemberRole {
    id: ID!
    name: String!
    description: String!
    """
    Whether the role is a built-in role. Built-in roles cannot be deleted or modified.
    """
    locked: Boolean!
    organizationAccessScopes: [OrganizationAccessScope!]!
    projectAccessScopes: [ProjectAccessScope!]!
    targetAccessScopes: [TargetAccessScope!]!
    """
    Whether the role can be deleted (based on current user's permissions)
    """
    canDelete: Boolean!
    """
    Whether the role can be updated (based on current user's permissions)
    """
    canUpdate: Boolean!
    """
    Whether the role can be used to invite new members (based on current user's permissions)
    """
    canInvite: Boolean!
    membersCount: Int!
  }

  input CreateMemberRoleInput {
    organization: ID!
    name: String!
    description: String!
    organizationAccessScopes: [OrganizationAccessScope!]!
    projectAccessScopes: [ProjectAccessScope!]!
    targetAccessScopes: [TargetAccessScope!]!
  }

  type CreateMemberRoleOk {
    updatedOrganization: Organization!
  }

  type CreateMemberRoleInputErrors {
    name: String
    description: String
  }

  type CreateMemberRoleError implements Error {
    message: String!
    """
    The detailed validation error messages for the input fields.
    """
    inputErrors: CreateMemberRoleInputErrors
  }

  """
  @oneOf
  """
  type CreateMemberRoleResult {
    ok: CreateMemberRoleOk
    error: CreateMemberRoleError
  }

  input UpdateMemberRoleInput {
    organization: ID!
    role: ID!
    name: String!
    description: String!
    organizationAccessScopes: [OrganizationAccessScope!]!
    projectAccessScopes: [ProjectAccessScope!]!
    targetAccessScopes: [TargetAccessScope!]!
  }

  type UpdateMemberRoleOk {
    updatedRole: MemberRole!
  }

  type UpdateMemberRoleInputErrors {
    name: String
    description: String
  }

  type UpdateMemberRoleError implements Error {
    message: String!
    """
    The detailed validation error messages for the input fields.
    """
    inputErrors: UpdateMemberRoleInputErrors
  }

  """
  @oneOf
  """
  type UpdateMemberRoleResult {
    ok: UpdateMemberRoleOk
    error: UpdateMemberRoleError
  }

  input DeleteMemberRoleInput {
    organization: ID!
    role: ID!
  }

  type DeleteMemberRoleOk {
    updatedOrganization: Organization!
  }

  type DeleteMemberRoleError implements Error {
    message: String!
  }

  """
  @oneOf
  """
  type DeleteMemberRoleResult {
    ok: DeleteMemberRoleOk
    error: DeleteMemberRoleError
  }

  input AssignMemberRoleInput {
    organization: ID!
    member: ID!
    role: ID!
  }

  type AssignMemberRoleOk {
    updatedMember: Member!
    previousMemberRole: MemberRole
  }

  type AssignMemberRoleError implements Error {
    message: String!
  }

  """
  @oneOf
  """
  type AssignMemberRoleResult {
    ok: AssignMemberRoleOk
    error: AssignMemberRoleError
  }

  type MemberRoleMigrationGroup {
    id: ID!
    members: [Member!]!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
  }

  """
  @oneOf
  """
  input MigrateUnassignedMembersInput {
    assignRole: AssignMemberRoleMigrationInput
    createRole: CreateMemberRoleMigrationInput
  }

  input AssignMemberRoleMigrationInput {
    organization: ID!
    role: ID!
    members: [ID!]!
  }

  input CreateMemberRoleMigrationInput {
    organization: ID!
    name: String!
    description: String!
    organizationScopes: [OrganizationAccessScope!]!
    projectScopes: [ProjectAccessScope!]!
    targetScopes: [TargetAccessScope!]!
    members: [ID!]!
  }

  type MigrateUnassignedMembersResult {
    ok: MigrateUnassignedMembersOk
    error: MigrateUnassignedMembersError
  }

  type MigrateUnassignedMembersOk {
    updatedOrganization: Organization!
  }

  type MigrateUnassignedMembersError implements Error {
    message: String!
  }
`;
