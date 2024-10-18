import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    project(selector: ProjectSelectorInput!): Project
    projects(selector: OrganizationSelectorInput!): ProjectConnection!
  }

  extend type Mutation {
    createProject(input: CreateProjectInput!): CreateProjectResult!
    updateProjectSlug(input: UpdateProjectSlugInput!): UpdateProjectSlugResult!
    deleteProject(selector: ProjectSelectorInput!): DeleteProjectPayload!
  }

  type UpdateProjectGitRepositoryResult {
    ok: UpdateProjectGitRepositoryOk
    error: UpdateProjectGitRepositoryError
  }

  type UpdateProjectGitRepositoryError implements Error {
    message: String!
  }

  type UpdateProjectGitRepositoryOk {
    selector: ProjectSelector!
    updatedProject: Project!
  }

  input UpdateProjectSlugInput {
    slug: String!
    organizationSlug: String!
    projectSlug: String!
  }

  type UpdateProjectSlugResult {
    ok: UpdateProjectSlugOk
    error: UpdateProjectSlugError
  }

  type UpdateProjectSlugOk {
    selector: ProjectSelector!
    project: Project!
  }

  type UpdateProjectSlugError implements Error {
    message: String!
  }

  type CreateProjectResult {
    ok: CreateProjectOk
    error: CreateProjectError
  }
  type CreateProjectOk {
    createdProject: Project!
    createdTargets: [Target!]!
    updatedOrganization: Organization!
  }

  type CreateProjectInputErrors {
    slug: String
  }

  type CreateProjectError implements Error {
    message: String!
    inputErrors: CreateProjectInputErrors!
  }

  input ProjectSelectorInput {
    organizationSlug: String!
    projectSlug: String!
  }

  type ProjectSelector {
    organizationSlug: String!
    projectSlug: String!
  }

  enum ProjectType {
    FEDERATION
    STITCHING
    SINGLE
  }

  extend type Organization {
    projects: ProjectConnection!
  }

  type Project {
    id: ID!
    slug: String!
    cleanId: ID! @deprecated(reason: "Use the 'slug' field instead.")
    name: String! @deprecated(reason: "Use the 'slug' field instead.")
    type: ProjectType!
    buildUrl: String
    validationUrl: String
    experimental_nativeCompositionPerTarget: Boolean!
  }

  type ProjectConnection {
    nodes: [Project!]!
    total: Int!
  }

  input CreateProjectInput {
    slug: String!
    type: ProjectType!
    organizationSlug: String!
  }

  input UpdateProjectGitRepositoryInput {
    gitRepository: String
    organizationSlug: String!
    projectSlug: String!
  }

  type UpdateProjectPayload {
    selector: ProjectSelector!
    updatedProject: Project!
  }

  type DeleteProjectPayload {
    selector: ProjectSelector!
    deletedProject: Project!
  }
`;
