import type { UserResolvers } from './../../../__generated__/types.next';

export const User: Pick<UserResolvers, 'canSwitchOrganization'> = {
  canSwitchOrganization: user => !user.oidcIntegrationId,
};
