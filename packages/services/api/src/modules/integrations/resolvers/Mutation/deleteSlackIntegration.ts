import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { SlackIntegrationManager } from '../../providers/slack-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteSlackIntegration: NonNullable<
  MutationResolvers['deleteSlackIntegration']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  await injector.get(SlackIntegrationManager).unregister({
    organization: organizationId,
  });

  const organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });
  return { organization };
};
