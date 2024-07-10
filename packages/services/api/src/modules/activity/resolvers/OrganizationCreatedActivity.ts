import type { OrganizationCreatedActivityResolvers } from './../../../__generated__/types.next';

export const OrganizationCreatedActivity: OrganizationCreatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'ORGANIZATION_CREATED';
  },
};
