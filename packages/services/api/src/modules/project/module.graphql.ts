import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    project(selector: ProjectSelectorInput!): Project
    projects(selector: OrganizationSelectorInput!): ProjectConnection!
  }

  extend type Mutation {
    createProject(input: CreateProjectInput!): CreateProjectResult!
    updateProjectName(input: UpdateProjectNameInput!): UpdateProjectNameResult!
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

  type UpdateProjectNameResult {
    ok: UpdateProjectNameOk
    error: UpdateProjectNameError
  }

  type UpdateProjectNameOk {
    selector: ProjectSelector!
    updatedProject: Project!
  }

  type UpdateProjectNameError implements Error {
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
    name: String
    buildUrl: String
    validationUrl: String
  }

  type CreateProjectError implements Error {
    message: String!
    inputErrors: CreateProjectInputErrors!
  }

  input ProjectSelectorInput {
    organization: ID!
    project: ID!
  }

  type ProjectSelector {
    organization: ID!
    project: ID!
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
    cleanId: ID!
    name: String!
    type: ProjectType!
    buildUrl: String
    validationUrl: String
  }

  type ProjectConnection {
    nodes: [Project!]!
    total: Int!
  }

  input CreateProjectInput {
    name: String!
    type: ProjectType!
    organization: ID!
    buildUrl: String
    validationUrl: String
  }

  input UpdateProjectNameInput {
    name: String!
    organization: ID!
    project: ID!
  }

  input UpdateProjectGitRepositoryInput {
    gitRepository: String
    organization: ID!
    project: ID!
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
