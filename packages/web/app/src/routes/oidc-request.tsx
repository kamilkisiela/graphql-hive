import { z } from 'zod';
import { isProviderEnabled } from '@/lib/auth/providers';
import { redirectToPathSchema } from '@/lib/route-utils';
import { OrganizationOIDCRequestPage } from '@/pages/organization-oidc-request';
import { createRoute, redirect } from '@tanstack/react-router';
import { withHeaderRoute } from './with-header';

const OrganizationOIDCRequestRouteSearch = z.object({
  id: z.string({ required_error: 'OIDC ID is required' }),
  redirectToPath: redirectToPathSchema,
});

// An auth interstitial: under the header, beside the organization route rather than inside it.
export const organizationOIDCRequestRoute = createRoute({
  getParentRoute: () => withHeaderRoute,
  path: '$organizationSlug/oidc-request',
  validateSearch(search) {
    return OrganizationOIDCRequestRouteSearch.parse(search);
  },
  // Without an OIDC provider there is nothing to ask; carry on to where the viewer was headed.
  beforeLoad: ({ search }) => {
    if (!isProviderEnabled('oidc')) {
      throw redirect({ to: search.redirectToPath });
    }
  },
  component: function OrganizationOIDCRequestRoute() {
    const { id, redirectToPath } = organizationOIDCRequestRoute.useSearch();
    return <OrganizationOIDCRequestPage oidcId={id} redirectToPath={redirectToPath} />;
  },
});
