import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    organization(selector: OrganizationSelectorInput!): OrganizationPayload
    organizationByInviteCode(code: String!): OrganizationByInviteCodePayload
    organizations: OrganizationConnection!
  }

  extend type Mutation {
    createOrganization(input: CreateOrganizationInput!): OrganizationPayload!
    deleteOrganization(
      selector: OrganizationSelectorInput!
    ): OrganizationPayload!
    deleteOrganizationMembers(
      selector: OrganizationMembersSelectorInput!
    ): OrganizationPayload!
    joinOrganization(code: String!): JoinOrganizationPayload!
    resetInviteCode(selector: OrganizationSelectorInput!): OrganizationPayload!
    updateOrganizationName(
      input: UpdateOrganizationNameInput!
    ): OrganizationPayload!
    updateOrganizationMemberAccess(
      input: OrganizationMemberAccessInput!
    ): OrganizationPayload!
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

  union JoinOrganizationPayload =
      OrganizationInvitationError
    | OrganizationPayload

  union OrganizationByInviteCodePayload =
      OrganizationInvitationError
    | OrganizationInvitationPayload

  type OrganizationPayload {
    selector: OrganizationSelector!
    organization: Organization!
  }
`;
