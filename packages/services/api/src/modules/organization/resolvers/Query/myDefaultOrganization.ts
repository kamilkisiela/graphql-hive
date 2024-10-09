import { AuthManager } from '../../../auth/providers/auth-manager';
import { OIDCIntegrationsProvider } from '../../../oidc-integrations/providers/oidc-integrations.provider';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const myDefaultOrganization: NonNullable<QueryResolvers['myDefaultOrganization']> = async (
  _,
  { previouslyVisitedOrganizationId },
  { injector },
) => {
  const user = await injector.get(AuthManager).getCurrentUser();
  const organizationManager = injector.get(OrganizationManager);

  // For an OIDC Integration User we want to return the linked organization
  if (user?.oidcIntegrationId) {
    const oidcIntegration = await injector.get(OIDCIntegrationsProvider).getOIDCIntegrationById({
      oidcIntegrationId: user.oidcIntegrationId,
    });
    if (oidcIntegration.type === 'ok') {
      const org = await organizationManager.getOrganization({
        organization: oidcIntegration.organizationId,
      });

      return {
        selector: {
          organization: org.cleanId,
        },
        organization: org,
      };
    }

    return null;
  }

  // This is the organization that got stored as an cookie
  // We make sure it actually exists before directing to it.
  if (previouslyVisitedOrganizationId) {
    const orgId = await injector.get(IdTranslator).translateOrganizationIdSafe({
      organization: previouslyVisitedOrganizationId,
    });

    if (orgId) {
      const org = await organizationManager.getOrganization({
        organization: orgId,
      });

      if (org) {
        return {
          selector: {
            organization: org.cleanId,
          },
          organization: org,
        };
      }
    }
  }

  if (user?.id) {
    const allOrganizations = await organizationManager.getOrganizations();

    if (allOrganizations.length > 0) {
      const firstOrg = allOrganizations[0];

      return {
        selector: {
          organization: firstOrg.cleanId,
        },
        organization: firstOrg,
      };
    }
  }

  return null;
};
