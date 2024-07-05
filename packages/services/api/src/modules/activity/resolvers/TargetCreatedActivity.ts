import type { TargetCreatedActivityResolvers } from './../../../__generated__/types.next';

export const TargetCreatedActivity: TargetCreatedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'TARGET_CREATED';
  },
};
