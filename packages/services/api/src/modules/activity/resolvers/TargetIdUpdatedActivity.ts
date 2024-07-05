import type { ActivityObject } from '../../../shared/entities';
import type { TargetIdUpdatedActivityResolvers } from './../../../__generated__/types.next';

export const TargetIdUpdatedActivity: TargetIdUpdatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'TARGET_ID_UPDATED';
  },
  value(activity: any) {
    return (activity as ActivityObject).meta.value;
  },
};
