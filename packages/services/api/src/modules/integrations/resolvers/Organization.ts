import { GitHubIntegrationManager } from '../providers/github-integration-manager';
import { SlackIntegrationManager } from '../providers/slack-integration-manager';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<
  OrganizationResolvers,
  'gitHubIntegration' | 'hasGitHubIntegration' | 'hasSlackIntegration'
> = {
  gitHubIntegration: async (organization, _, { injector }) => {
    const repositories = await injector.get(GitHubIntegrationManager).getRepositories({
      organization: organization.id,
    });

    if (repositories == null) {
      return null;
    }

    return {
      repositories,
    };
  },
  hasGitHubIntegration: (organization, _, { injector }) => {
    return injector.get(GitHubIntegrationManager).isAvailable({
      organization: organization.id,
    });
  },
  hasSlackIntegration: (organization, _, { injector }) => {
    return injector.get(SlackIntegrationManager).isAvailable({
      organization: organization.id,
    });
  },
};
