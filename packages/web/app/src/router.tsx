import { lazy, useCallback, useEffect } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { ToastContainer } from 'react-toastify';
import SuperTokens, { SuperTokensWrapper } from 'supertokens-auth-react';
import Session from 'supertokens-auth-react/recipe/session';
import { Provider as UrqlProvider } from 'urql';
import { z } from 'zod';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import { Toaster } from '@/components/ui/toaster';
import { frontendConfig } from '@/config/supertokens/frontend';
import { env } from '@/env/frontend';
import * as gtag from '@/lib/gtag';
import { urqlClient } from '@/lib/urql';
import { configureScope, init } from '@sentry/react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import { ErrorComponent } from './components/error';
import { NotFound } from './components/not-found';
import 'react-toastify/dist/ReactToastify.css';
import { authenticated } from './components/authenticated-container';
import { AuthPage } from './pages/auth';
import { DevPage } from './pages/dev';
import { IndexPage } from './pages/index';
import { LogoutPage } from './pages/logout';
import { ManagePage } from './pages/manage';
import { OrganizationPage } from './pages/organization';
import { JoinOrganizationPage } from './pages/organization-join';
import { OrganizationMembersPage } from './pages/organization-members';
import { NewOrgPage } from './pages/organization-new';
import { OrganizationPolicyPage } from './pages/organization-policy';
import { OrganizationSettingsPage } from './pages/organization-settings';
import { OrganizationSubscriptionPage } from './pages/organization-subscription';
import { OrganizationSubscriptionManagePage } from './pages/organization-subscription-manage';
import { OrganizationSupportPage } from './pages/organization-support';
import { OrganizationSupportTicketPage } from './pages/organization-support-ticket';
import { OrganizationTransferPage } from './pages/organization-transfer';
import { ProjectPage } from './pages/project';
import { ProjectAlertsPage } from './pages/project-alerts';
import { ProjectPolicyPage } from './pages/project-policy';
import { ProjectSettingsPage } from './pages/project-settings';
import { TargetPage } from './pages/target';
import { TargetAppVersionPage } from './pages/target-app-version';
import { TargetAppsPage } from './pages/target-apps';
import { TargetChecksPage } from './pages/target-checks';
import { TargetChecksSinglePage } from './pages/target-checks-single';
import { TargetExplorerPage } from './pages/target-explorer';
import { TargetExplorerDeprecatedPage } from './pages/target-explorer-deprecated';
import { TargetExplorerTypePage } from './pages/target-explorer-type';
import { TargetExplorerUnusedPage } from './pages/target-explorer-unused';
import { TargetHistoryPage } from './pages/target-history';
import { TargetHistoryVersionPage } from './pages/target-history-version';
import { TargetInsightsPage } from './pages/target-insights';
import { TargetInsightsClientPage } from './pages/target-insights-client';
import { TargetInsightsCoordinatePage } from './pages/target-insights-coordinate';
import { TargetInsightsOperationPage } from './pages/target-insights-operation';
import { TargetLaboratoryPage } from './pages/target-laboratory';
import { TargetSettingsPage } from './pages/target-settings';

if (globalThis.window) {
  SuperTokens.init(frontendConfig());
  if (env.sentry) {
    init({
      dsn: env.sentry.dsn,
      enabled: true,
      dist: 'webapp',
      release: env.release,
      environment: env.environment,
    });
  }
}

const LazyTanStackRouterDevtools = lazy(() =>
  import('@tanstack/router-devtools').then(({ TanStackRouterDevtools }) => ({
    default: TanStackRouterDevtools,
  })),
);

function identifyOnSentry(userId: string, email: string): void {
  configureScope(scope => {
    scope.setUser({ id: userId, email });
  });
}

function RootComponent() {
  useEffect(() => {
    void Session.doesSessionExist().then(async doesExist => {
      if (!doesExist) {
        return;
      }
      const payload = await Session.getAccessTokenPayloadSecurely();
      identifyOnSentry(payload.superTokensUserId, payload.email);
    });
  }, []);

  return (
    <HelmetProvider>
      {env.analytics.googleAnalyticsTrackingId && (
        <Helmet>
          <script id="gtag-init" key="gtag-init" type="text/javascript">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${env.analytics.googleAnalyticsTrackingId}', {
              page_path: window.location.pathname,
            });
          `}</script>
          <script
            key="gtag-script"
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${env.analytics.googleAnalyticsTrackingId}`}
            type="text/javascript"
          />
        </Helmet>
      )}
      <SuperTokensWrapper>
        <UrqlProvider value={urqlClient}>
          <LoadingAPIIndicator />
          <Outlet />
        </UrqlProvider>
      </SuperTokensWrapper>
      <Toaster />
      <ToastContainer hideProgressBar />
      {/* eslint-disable-next-line no-process-env */}
      {process.env.NODE_ENV === 'development' && <LazyTanStackRouterDevtools />}
    </HelmetProvider>
  );
}

const root = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

const anonymousRoute = createRoute({
  getParentRoute: () => root,
  id: 'anonymous',
});

const authenticatedRoute = createRoute({
  getParentRoute: () => root,
  id: 'authenticated',
  component: authenticated(function AuthenticatedRoute() {
    return <Outlet />;
  }),
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const authRoute = createRoute({
  getParentRoute: () => anonymousRoute,
  path: 'auth',
  component: AuthPage,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: IndexPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => root,
  path: '404',
  component: NotFound,
});

const devRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'dev',
  component: DevPage,
});

const newOrgPage = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'org/new',
  component: NewOrgPage,
});

const logoutRoute = createRoute({
  getParentRoute: () => root,
  path: 'logout',
  component: LogoutPage,
});

const manageRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'manage',
  component: ManagePage,
});

const joinOrganizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'join/$inviteCode',
  component: function JoinOrganizationRoute() {
    const { inviteCode } = joinOrganizationRoute.useParams();
    return <JoinOrganizationPage inviteCode={inviteCode} />;
  },
});

const transferOrganizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: 'transfer/$organizationId/$code',
  component: function TransferOrganizationRoute() {
    const { organizationId, code } = transferOrganizationRoute.useParams();
    return <OrganizationTransferPage organizationId={organizationId} code={code} />;
  },
});

const organizationRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$organizationId',
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const organizationIndexRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: '/',
  component: function OrganizationRoute() {
    const { organizationId } = organizationRoute.useParams();
    return <OrganizationPage organizationId={organizationId} />;
  },
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const organizationSupportRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/support',
  component: function OrganizationSupportRoute() {
    const { organizationId } = organizationSupportRoute.useParams();
    return <OrganizationSupportPage organizationId={organizationId} />;
  },
});

const organizationSupportTicketRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/support/ticket/$ticketId',
  component: function OrganizationSupportTicketRoute() {
    const { organizationId, ticketId } = organizationSupportTicketRoute.useParams();
    return <OrganizationSupportTicketPage organizationId={organizationId} ticketId={ticketId} />;
  },
});

const organizationSubscriptionRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/subscription',
  component: function OrganizationSubscriptionRoute() {
    const { organizationId } = organizationSubscriptionRoute.useParams();
    return <OrganizationSubscriptionPage organizationId={organizationId} />;
  },
});

const organizationSubscriptionManageLegacyRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/subscription/manage',
  component: function OrganizationSubscriptionManageLegacyRoute() {
    const { organizationId } = organizationSubscriptionManageLegacyRoute.useParams();
    return <Navigate to="/$organizationId/view/manage-subscription" params={{ organizationId }} />;
  },
});

const organizationSubscriptionManageRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/manage-subscription',
  component: function OrganizationSubscriptionManageRoute() {
    const { organizationId } = organizationSubscriptionManageRoute.useParams();
    return <OrganizationSubscriptionManagePage organizationId={organizationId} />;
  },
});

const organizationPolicyRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/policy',
  component: function OrganizationPolicyRoute() {
    const { organizationId } = organizationPolicyRoute.useParams();
    return <OrganizationPolicyPage organizationId={organizationId} />;
  },
});

const organizationSettingsRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/settings',
  component: function OrganizationSettingsRoute() {
    const { organizationId } = organizationSettingsRoute.useParams();
    return <OrganizationSettingsPage organizationId={organizationId} />;
  },
});

const OrganizationMembersRouteSearch = z.object({
  page: z.enum(['list', 'roles', 'invitations', 'migration']).catch('list').default('list'),
});

const organizationMembersRoute = createRoute({
  getParentRoute: () => organizationRoute,
  path: 'view/members',
  validateSearch(search) {
    return OrganizationMembersRouteSearch.parse(search);
  },
  component: function OrganizationMembersRoute() {
    const { organizationId } = organizationMembersRoute.useParams();
    const { page } = organizationMembersRoute.useSearch();
    const navigate = useNavigate({ from: organizationMembersRoute.fullPath });
    const onPageChange = useCallback(
      (newPage: z.infer<typeof OrganizationMembersRouteSearch>['page']) => {
        void navigate({ search: { page: newPage } });
      },
      [navigate],
    );

    return (
      <OrganizationMembersPage
        organizationId={organizationId}
        page={page}
        onPageChange={onPageChange}
      />
    );
  },
});

const projectRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$organizationId/$projectId',
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: '/',
  component: function ProjectRoute() {
    const { organizationId, projectId } = projectIndexRoute.useParams();
    return <ProjectPage organizationId={organizationId} projectId={projectId} />;
  },
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'view/settings',
  component: function ProjectSettingsRoute() {
    const { organizationId, projectId } = projectSettingsRoute.useParams();
    return <ProjectSettingsPage organizationId={organizationId} projectId={projectId} />;
  },
});

const projectPolicyRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'view/policy',
  component: function ProjectPolicyRoute() {
    const { organizationId, projectId } = projectPolicyRoute.useParams();
    return <ProjectPolicyPage organizationId={organizationId} projectId={projectId} />;
  },
});

const projectAlertsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: 'view/alerts',
  component: function ProjectAlertsRoute() {
    const { organizationId, projectId } = projectAlertsRoute.useParams();
    return <ProjectAlertsPage organizationId={organizationId} projectId={projectId} />;
  },
});

const targetRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '$organizationId/$projectId/$targetId',
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

const targetIndexRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: '/',
  component: function TargetRoute() {
    const { organizationId, projectId, targetId } = targetIndexRoute.useParams();
    return <TargetPage organizationId={organizationId} projectId={projectId} targetId={targetId} />;
  },
});

const TargetSettingRouteSearch = z.object({
  page: z
    .enum([
      'general',
      'cdn',
      'registry-token',
      'breaking-changes',
      'base-schema',
      'schema-contracts',
    ])
    .default('general')
    .optional(),
});

const targetSettingsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'settings',
  validateSearch(search) {
    return TargetSettingRouteSearch.parse(search);
  },
  component: function TargetSettingsRoute() {
    const { organizationId, projectId, targetId } = targetSettingsRoute.useParams();
    const { page } = targetSettingsRoute.useSearch();

    return (
      <TargetSettingsPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        page={page}
      />
    );
  },
});

const targetLaboratoryRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'laboratory',
  component: function TargetLaboratoryRoute() {
    const { organizationId, projectId, targetId } = targetLaboratoryRoute.useParams();
    return (
      <TargetLaboratoryPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetAppsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'apps',
  component: function TargetAppsRoute() {
    const { organizationId, projectId, targetId } = targetAppsRoute.useParams();
    return (
      <TargetAppsPage organizationId={organizationId} projectId={projectId} targetId={targetId} />
    );
  },
});

const targetAppVersionRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'apps/$appName/$appVersion',
  component: function TargetAppVersionRoute() {
    const { organizationId, projectId, targetId, appName, appVersion } =
      targetAppVersionRoute.useParams();
    return (
      <TargetAppVersionPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        appName={appName}
        appVersion={appVersion}
      />
    );
  },
});

const targetInsightsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights',
  component: function TargetInsightsRoute() {
    const { organizationId, projectId, targetId } = targetInsightsRoute.useParams();
    return (
      <TargetInsightsPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetInsightsCoordinateRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/schema-coordinate/$coordinate',
  component: function TargetInsightsRoute() {
    const { organizationId, projectId, targetId, coordinate } =
      targetInsightsCoordinateRoute.useParams();
    return (
      <TargetInsightsCoordinatePage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        coordinate={coordinate}
      />
    );
  },
});

const targetInsightsClientRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/client/$name',
  component: function TargetInsightsRoute() {
    const { organizationId, projectId, targetId, name } = targetInsightsClientRoute.useParams();
    return (
      <TargetInsightsClientPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        name={name}
      />
    );
  },
});

const targetInsightsOperationsRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'insights/$operationName/$operationHash',
  component: function TargetInsightsRoute() {
    const { organizationId, projectId, targetId, operationName, operationHash } =
      targetInsightsOperationsRoute.useParams();
    return (
      <TargetInsightsOperationPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        operationName={operationName}
        operationHash={operationHash}
      />
    );
  },
});

const targetHistoryRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'history',
  component: function TargetHistoryRoute() {
    const { organizationId, projectId, targetId } = targetHistoryRoute.useParams();
    return (
      <TargetHistoryPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetHistoryVersionRoute = createRoute({
  getParentRoute: () => targetHistoryRoute,
  path: '$versionId',
  component: function TargetHistoryVersionRoute() {
    const { organizationId, projectId, targetId, versionId } =
      targetHistoryVersionRoute.useParams();
    return (
      <TargetHistoryVersionPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        versionId={versionId}
      />
    );
  },
});

const targetExplorerRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'explorer',
  component: function TargetExplorerRoute() {
    const { organizationId, projectId, targetId } = targetExplorerRoute.useParams();
    return (
      <TargetExplorerPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetExplorerTypeRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'explorer/$typename',
  component: function TargetExplorerTypeRoute() {
    const { organizationId, projectId, targetId, typename } = targetExplorerTypeRoute.useParams();
    return (
      <TargetExplorerTypePage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        typename={typename}
      />
    );
  },
});

const targetExplorerDeprecatedRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'explorer/deprecated',
  component: function TargetExplorerDeprecatedRoute() {
    const { organizationId, projectId, targetId } = targetExplorerDeprecatedRoute.useParams();
    return (
      <TargetExplorerDeprecatedPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetExplorerUnusedRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'explorer/unused',
  component: function TargetExplorerUnusedRoute() {
    const { organizationId, projectId, targetId } = targetExplorerUnusedRoute.useParams();
    return (
      <TargetExplorerUnusedPage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
      />
    );
  },
});

const targetChecksRoute = createRoute({
  getParentRoute: () => targetRoute,
  path: 'checks',
  component: function TargetChecksRoute() {
    const { organizationId, projectId, targetId } = targetChecksRoute.useParams();
    return (
      <TargetChecksPage organizationId={organizationId} projectId={projectId} targetId={targetId} />
    );
  },
});

const targetChecksSingleRoute = createRoute({
  getParentRoute: () => targetChecksRoute,
  path: '$schemaCheckId',
  component: function TargetChecksSingleRoute() {
    const { organizationId, projectId, targetId, schemaCheckId } =
      targetChecksSingleRoute.useParams();
    return (
      <TargetChecksSinglePage
        organizationId={organizationId}
        projectId={projectId}
        targetId={targetId}
        schemaCheckId={schemaCheckId}
      />
    );
  },
});

const routeTree = root.addChildren([
  notFoundRoute,
  anonymousRoute.addChildren([
    authRoute.addChildren([
      /* I have no idea why (yet), but this is necessary to make /auth/reset-password page works */
    ]),
  ]),
  authenticatedRoute.addChildren([
    indexRoute,
    devRoute,
    newOrgPage,
    manageRoute,
    logoutRoute,
    organizationRoute.addChildren([
      organizationIndexRoute,
      joinOrganizationRoute,
      transferOrganizationRoute,
      organizationSupportRoute,
      organizationSupportTicketRoute,
      organizationSubscriptionRoute,
      organizationSubscriptionManageRoute,
      organizationSubscriptionManageLegacyRoute,
      organizationMembersRoute,
      organizationPolicyRoute,
      organizationSettingsRoute,
    ]),
    projectRoute.addChildren([
      projectIndexRoute,
      projectSettingsRoute,
      projectPolicyRoute,
      projectAlertsRoute,
    ]),
    targetRoute.addChildren([
      targetIndexRoute,
      targetSettingsRoute,
      targetLaboratoryRoute,
      targetHistoryRoute.addChildren([targetHistoryVersionRoute]),
      targetInsightsRoute,
      targetInsightsCoordinateRoute,
      targetInsightsClientRoute,
      targetInsightsOperationsRoute,
      targetExplorerRoute,
      targetExplorerDeprecatedRoute,
      targetExplorerUnusedRoute,
      targetExplorerTypeRoute,
      targetChecksRoute.addChildren([targetChecksSingleRoute]),
      targetAppVersionRoute,
      targetAppsRoute,
    ]),
  ]),
]);

export const router = createRouter({ routeTree });

router.history.subscribe(() => {
  gtag.pageview(router.history.location.href);
});
