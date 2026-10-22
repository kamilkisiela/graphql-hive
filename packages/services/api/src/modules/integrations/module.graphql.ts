import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    deleteSlackIntegration(input: OrganizationSelectorInput!): DeleteSlackIntegrationResult!
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
    isGitHubIntegrationFeatureEnabled: Boolean!
  }

  extend type Organization {
    hasSlackIntegration: Boolean!
    hasGitHubIntegration: Boolean!
    gitHubIntegration: GitHubIntegration
    viewerCanModifySlackIntegration: Boolean!
    viewerCanModifyGitHubIntegration: Boolean!
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
