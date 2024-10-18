import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationSlugModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createOrganization: NonNullable<MutationResolvers['createOrganization']> = async (
  _,
  { input },
  { injector },
) => {
  const slugParseResult = OrganizationSlugModel.safeParse(input.slug);
  if (!slugParseResult.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          slug: slugParseResult.error.issues[0].message ?? null,
        },
      },
    };
  }

  const user = await injector.get(AuthManager).getCurrentUser();
  const result = await injector.get(OrganizationManager).createOrganization({
    slug: input.slug,
    user,
  });

  if (result.ok) {
    return {
      ok: {
        createdOrganizationPayload: {
          selector: {
            organizationSlug: result.organization.slug,
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
      inputErrors: {},
    },
  };
};
