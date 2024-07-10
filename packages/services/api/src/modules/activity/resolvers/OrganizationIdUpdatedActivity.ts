import type { ActivityObject } from '../../../shared/entities';
import type { OrganizationIdUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const OrganizationIdUpdatedActivity: OrganizationIdUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'ORGANIZATION_ID_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
