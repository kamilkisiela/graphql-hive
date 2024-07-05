import type { MemberAddedActivityResolvers } from './../../../__generated__/types.next';

export const MemberAddedActivity: MemberAddedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'MEMBER_ADDED';
  },
};
