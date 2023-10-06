import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addSlackIntegration(input: AddSlackIntegrationInput!): Boolean!
    deleteSlackIntegration(input: OrganizationSelectorInput!): DeleteSlackIntegrationResult!
    addGitHubIntegration(input: AddGitHubIntegrationInput!): Boolean!
    deleteGitHubIntegration(input: OrganizationSelectorInput!): DeleteGitHubIntegrationResult!
    enableProjectNameInGithubCheck(input: ProjectSelectorInput!): Project!
  }

  type DeleteSlackIntegrationResult {
    organization: Organization!
  }

  type DeleteGitHubIntegrationResult {
    organization: Organization!
  }

  extend type Query {
    organizationByGitHubInstallationId(installation: ID!): Organization
    isGitHubIntegrationFeatureEnabled: Boolean!
  }

  extend type Organization {
    hasSlackIntegration: Boolean!
    hasGitHubIntegration: Boolean!
    gitHubIntegration: GitHubIntegration
  }

  input AddSlackIntegrationInput {
    organization: ID!
    token: String!
  }

  input AddGitHubIntegrationInput {
    organization: ID!
    installationId: ID!
  }

  type GitHubIntegration {
    repositories: [GitHubRepository!]!
  }

  type GitHubRepository {
    nameWithOwner: String!
  }

  extend type Project {
    isProjectNameInGitHubCheckEnabled: Boolean!
  }
`;
