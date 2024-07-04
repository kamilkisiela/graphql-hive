import { IdTranslator } from '../../../shared/providers/id-translator';
import { ActivityManager } from '../../providers/activity-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const organizationActivities: NonNullable<QueryResolvers['organizationActivities']> = async (
  _,
  { selector },
  { injector },
) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(selector);

  return injector.get(ActivityManager).getByOrganization({
    organization,
    limit: selector.limit,
  });
};
