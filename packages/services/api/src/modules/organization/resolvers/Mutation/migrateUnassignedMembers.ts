import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const migrateUnassignedMembers: NonNullable<
  MutationResolvers['migrateUnassignedMembers']
> = async (_, { input }, { injector }) => {
  const organizationIdFromInput = input.assignRole?.organization ?? input.createRole?.organization;

  if (!organizationIdFromInput) {
    return {
      error: {
        message: 'Assign a role or create a new one',
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: organizationIdFromInput,
  });

  return injector.get(OrganizationManager).migrateUnassignedMembers({
    organizationId,
    assignRole: input.assignRole,
    createRole: input.createRole,
  });
};
