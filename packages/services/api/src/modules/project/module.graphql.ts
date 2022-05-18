import { gql } from 'graphql-modules';

export default gql`
  extend type Query {
    project(selector: ProjectSelectorInput!): Project
    projects(selector: OrganizationSelectorInput!): ProjectConnection!
  }

  extend type Mutation {
    createProject(input: CreateProjectInput!): CreateProjectPayload!
    updateProjectName(input: UpdateProjectNameInput!): UpdateProjectPayload!
    updateProjectGitRepository(
      input: UpdateProjectGitRepositoryInput!
    ): UpdateProjectPayload!
    deleteProject(selector: ProjectSelectorInput!): DeleteProjectPayload!
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
    CUSTOM
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

  type CreateProjectPayload {
    selector: ProjectSelector!
    createdProject: Project!
    createdTarget: Target!
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
