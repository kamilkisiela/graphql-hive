import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationName: NonNullable<
  MutationResolvers['updateOrganizationName']
> = async (_, { input }, { injector }) => {
  const result = OrganizationNameModel.safeParse(input.name?.trim());

  if (!result.success) {
    return {
      error: {
        message:
          result.error.formErrors.fieldErrors?.[0]?.[0] ?? 'Changing the organization name failed.',
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  const organization = await injector.get(OrganizationManager).updateName({
    name: input.name,
    organization: organizationId,
  });

  return {
    ok: {
      updatedOrganizationPayload: {
        selector: {
          organization: organization.cleanId,
        },
        organization,
      },
    },
  };
};
