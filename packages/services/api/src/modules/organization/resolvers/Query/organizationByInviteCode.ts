import { OrganizationManager } from '../../providers/organization-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const organizationByInviteCode: NonNullable<
  QueryResolvers['organizationByInviteCode']
> = async (_, { code }, { injector }) => {
  const organization = await injector.get(OrganizationManager).getOrganizationByInviteCode({
    code,
  });

  if ('message' in organization) {
    return organization;
  }

  return {
    __typename: 'OrganizationInvitationPayload',
    name: organization.name,
  };
};
