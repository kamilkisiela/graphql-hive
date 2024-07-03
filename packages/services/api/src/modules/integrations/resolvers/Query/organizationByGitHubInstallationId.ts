import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const organizationByGitHubInstallationId: NonNullable<
  QueryResolvers['organizationByGitHubInstallationId']
> = (_, { installation }, { injector }) => {
  return injector.get(GitHubIntegrationManager).getOrganization({
    installation,
  });
};
