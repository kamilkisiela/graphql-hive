import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteGitHubIntegration: NonNullable<
  MutationResolvers['deleteGitHubIntegration']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  await injector.get(GitHubIntegrationManager).unregister({
    organization: organizationId,
  });

  const organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });
  return { organization };
};
