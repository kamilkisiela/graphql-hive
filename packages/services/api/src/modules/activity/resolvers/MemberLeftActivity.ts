import type { ActivityObject } from '../../../shared/entities';
import type { MemberLeftActivityResolvers } from './../../../__generated__/types.next';

export const MemberLeftActivity: MemberLeftActivityResolvers = {
  __isTypeOf(activity) {
    return activity.type === 'MEMBER_LEFT';
  },
  email(activity: any) {
    return (activity as ActivityObject).meta.email;
  },
};
