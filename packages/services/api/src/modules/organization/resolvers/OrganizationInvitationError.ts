import type { OrganizationInvitationErrorResolvers } from './../../../__generated__/types.next';

export const OrganizationInvitationError: OrganizationInvitationErrorResolvers = {
  __isTypeOf: obj => {
    return !!obj.message;
  },
};
