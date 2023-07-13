import { gql } from 'graphql-modules';

export default gql`
  extend type Mutation {
    addSlackIntegration(input: AddSlackIntegrationInput!): Boolean!
    deleteSlackIntegration(input: OrganizationSelectorInput!): Boolean!
    addGitHubIntegration(input: AddGitHubIntegrationInput!): Boolean!
    deleteGitHubIntegration(input: OrganizationSelectorInput!): Boolean!
  }

  extend type Query {
    hasSlackIntegration(selector: OrganizationSelectorInput!): Boolean!
    hasGitHubIntegration(selector: OrganizationSelectorInput!): Boolean!
    gitHubIntegration(selector: OrganizationSelectorInput!): GitHubIntegration
    organizationByGitHubInstallationId(installation: ID!): Organization
    isGitHubIntegrationFeatureEnabled: Boolean!
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
    gitRepository: String
  }
`;
