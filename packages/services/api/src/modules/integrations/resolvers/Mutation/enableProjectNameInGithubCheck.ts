import { IdTranslator } from '../../../shared/providers/id-translator';
import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const enableProjectNameInGithubCheck: NonNullable<
  MutationResolvers['enableProjectNameInGithubCheck']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);
  return injector.get(GitHubIntegrationManager).enableProjectNameInGithubCheck({
    organization,
    project,
  });
};
