import Session from 'supertokens-auth-react/recipe/session';
import { authenticated } from '@/components/authenticated-container';
import { IndexPage } from '@/pages/index';
import { ManagePage } from '@/pages/manage';
import { NativeCompositionDiff } from '@/pages/native-composition-diff';
import { NewOrgPage } from '@/pages/organization-new';
import { OrganizationTransferPage } from '@/pages/organization-transfer';
import { createRoute, Outlet, redirect } from '@tanstack/react-router';
import { root } from './root';

export const authenticatedRoute = createRoute({
  getParentRoute: () => root,
  id: 'authenticated',
  // Loaders run before render, so an anonymous visitor is turned away here, not by `SessionAuth`.
  beforeLoad: async ({ location }) => {
    if (!(await Session.doesSessionExist())) {
      throw redirect({ to: '/auth', search: { redirectToPath: location.href } });
    }
  },
  component: authenticated(function AuthenticatedRoute() {
    return <Outlet />;
  }),
});

export const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: IndexPage,
});

export const nativeCompositionDiffRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'native-composition-compatibility-report/$projectId',
  component: function NativeCompositionDiffRoute() {
    const { projectId } = nativeCompositionDiffRoute.useParams();
    return <NativeCompositionDiff projectId={projectId} />;
  },
});

export const newOrgPage = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'org/new',
  component: NewOrgPage,
});

export const manageRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'manage',
  component: ManagePage,
});

export const transferOrganizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'action/transfer/$organizationSlug/$code',
  component: function TransferOrganizationRoute() {
    const { organizationSlug, code } = transferOrganizationRoute.useParams();
    return <OrganizationTransferPage organizationSlug={organizationSlug} code={code} />;
  },
});
