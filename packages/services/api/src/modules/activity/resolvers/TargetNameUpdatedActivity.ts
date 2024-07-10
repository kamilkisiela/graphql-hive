import type { ActivityObject } from '../../../shared/entities';
import type { TargetNameUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const TargetNameUpdatedActivity: TargetNameUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'TARGET_NAME_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
