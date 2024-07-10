import type { ActivityObject } from '../../../shared/entities';
import type { OrganizationNameUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const OrganizationNameUpdatedActivity: OrganizationNameUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'ORGANIZATION_NAME_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
