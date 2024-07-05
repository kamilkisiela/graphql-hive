import type { ActivityObject } from '../../../shared/entities';
import type { TargetDeletedActivityResolvers } from './../../../__generated__/types.next';

export const TargetDeletedActivity: TargetDeletedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'TARGET_DELETED';
  },
  name(activity: any) {
    return (activity as ActivityObject).meta.name;
  },
  cleanId(activity: any) {
    return (activity as ActivityObject).meta.cleanId;
  },
};
