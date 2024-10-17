import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationSlugModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationSlug: NonNullable<
  MutationResolvers['updateOrganizationSlug']
> = async (_, { input }, { injector }) => {
  const parsedInput = OrganizationSlugModel.safeParse(input.slug);

  if (!parsedInput.success) {
    return {
      error: {
        message:
          parsedInput.error.formErrors.fieldErrors?.[0]?.[0] ??
          'Changing the organization slug failed.',
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const result = await injector.get(OrganizationManager).updateSlug({
    slug: parsedInput.data,
    organization: organizationId,
  });

  if (result.ok) {
    return {
      ok: {
        updatedOrganizationPayload: {
          selector: {
            organization: result.organization.slug,
          },
          organization: result.organization,
        },
      },
    };
  }

  return {
    ok: null,
    error: {
      message: result.message,
    },
  };
};
