import type { ActivityObject } from '../../../shared/entities';
import type { MemberDeletedActivityResolvers } from './../../../__generated__/types.next';

export const MemberDeletedActivity: MemberDeletedActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'MEMBER_DELETED';
  },
  email(activity: any) {
    return (activity as ActivityObject).meta.email;
  },
};
