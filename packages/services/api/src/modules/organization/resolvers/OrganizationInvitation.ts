import type { OrganizationInvitationResolvers } from './../../../__generated__/types.next';

export const OrganizationInvitation: OrganizationInvitationResolvers = {
  id: invitation => {
    return Buffer.from(
      [invitation.organization_id, invitation.email, invitation.code].join(':'),
    ).toString('hex');
  },
  createdAt: invitation => {
    return invitation.created_at;
  },
  expiresAt: invitation => {
    return invitation.expires_at;
  },
};
