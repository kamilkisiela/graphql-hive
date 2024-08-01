import type { UserResolvers } from './../../../__generated__/types.next';

export const User: Pick<UserResolvers, 'canSwitchOrganization' | '__isTypeOf'> = {
  canSwitchOrganization: user => !user.oidcIntegrationId,
};
