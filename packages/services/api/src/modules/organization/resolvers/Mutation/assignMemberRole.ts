import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const assignMemberRole: NonNullable<MutationResolvers['assignMemberRole']> = async (
  _,
  { input },
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  return injector.get(OrganizationManager).assignMemberRole({
    organizationId,
    userId: input.userId,
    roleId: input.roleId,
  });
};
