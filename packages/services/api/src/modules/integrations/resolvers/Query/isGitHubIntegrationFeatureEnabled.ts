import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const isGitHubIntegrationFeatureEnabled: NonNullable<
  QueryResolvers['isGitHubIntegrationFeatureEnabled']
> = (_, __, { injector }) => {
  return injector.get(GitHubIntegrationManager).isEnabled();
};
