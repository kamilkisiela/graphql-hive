import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { USAGE_DEFAULT_LIMITATIONS } from '../../constants';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrgRateLimit: NonNullable<MutationResolvers['updateOrgRateLimit']> = async (
  _,
  args,
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.selector.organization,
  });

  return injector.get(OrganizationManager).updateRateLimits({
    organization: organizationId,
    monthlyRateLimit: {
      retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
      operations: args.monthlyLimits.operations,
    },
  });
};
