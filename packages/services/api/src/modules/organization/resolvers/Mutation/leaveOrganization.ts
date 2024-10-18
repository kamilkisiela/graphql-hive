import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const leaveOrganization: NonNullable<MutationResolvers['leaveOrganization']> = async (
  _,
  { input },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organizationSlug: input.organizationSlug,
  });

  const result = await injector.get(OrganizationManager).leaveOrganization(organizationId);

  if (!result.ok) {
    return {
      error: {
        message: result.message,
      },
    };
  }

  return {
    ok: {
      organizationId,
    },
  };
};
