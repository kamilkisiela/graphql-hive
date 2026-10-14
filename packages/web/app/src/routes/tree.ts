import {
  anonymousRoute,
  authCallbackRoute,
  authIndexRoute,
  authOIDCRoute,
  authResetPasswordRoute,
  authRoute,
  authSignInRoute,
  authSignUpRoute,
  authSSORoute,
  authVerifyEmailRoute,
} from './anonymous';
import {
  authenticatedRoute,
  indexRoute,
  manageRoute,
  nativeCompositionDiffRoute,
  newOrgPage,
  transferOrganizationRoute,
} from './authenticated';
import { legacyRoutesUnder } from './legacy';
import { organizationOIDCRequestRoute } from './oidc-request';
import {
  organizationMembersGroupsRoute,
  organizationMembersIndexRoute,
  organizationMembersInvitationsRoute,
  organizationMembersRolesRoute,
  organizationMembersRoute,
} from './organization/members';
import {
  organizationIndexRoute,
  organizationRoute,
  organizationSubscriptionManageRoute,
  organizationSubscriptionRoute,
  organizationSupportRoute,
  organizationSupportTicketRoute,
} from './organization/route';
import {
  organizationSettingsAccessTokensRoute,
  organizationSettingsIndexRoute,
  organizationSettingsPersonalAccessTokensRoute,
  organizationSettingsPolicyRoute,
  organizationSettingsRoute,
  organizationSettingsSsoRoute,
} from './organization/settings';
import { projectAlertsRoute, projectIndexRoute, projectRoute } from './project/route';
import {
  projectSettingsAccessTokensRoute,
  projectSettingsCompositionRoute,
  projectSettingsIndexRoute,
  projectSettingsPolicyRoute,
  projectSettingsRoute,
} from './project/settings';
import { joinOrganizationRoute, logoutRoute, notFoundRoute, root } from './root';
import {
  targetAlertsCreateRoute,
  targetAlertsDetailRoute,
  targetAlertsIndexRoute,
  targetAlertsRoute,
  targetAlertsRulesRoute,
  targetAlertsWithNavRoute,
} from './target/alerts';
import { targetAppsRoute, targetAppVersionRoute } from './target/apps';
import {
  targetChecksAffectedDeploymentsRoute,
  targetChecksRoute,
  targetChecksSingleRoute,
} from './target/checks';
import {
  targetExplorerDeprecatedRoute,
  targetExplorerRoute,
  targetExplorerTypeRoute,
  targetExplorerUnusedRoute,
} from './target/explorer';
import {
  targetHistoryIndexRoute,
  targetHistoryRoute,
  targetHistoryVersionRoute,
} from './target/history';
import {
  targetInsightsClientRoute,
  targetInsightsCoordinateRoute,
  targetInsightsManageFiltersRoute,
  targetInsightsOperationsRoute,
  targetInsightsRoute,
} from './target/insights';
import { targetLaboratoryRoute } from './target/laboratory';
import {
  targetProposalsNewRoute,
  targetProposalsRoute,
  targetProposalsSingleRoute,
} from './target/proposals';
import { targetIndexRoute, targetRoute } from './target/route';
import {
  targetSettingsBaseSchemaRoute,
  targetSettingsBreakingChangesRoute,
  targetSettingsCdnRoute,
  targetSettingsIndexRoute,
  targetSettingsRegistryTokenRoute,
  targetSettingsRoute,
  targetSettingsSchemaContractsRoute,
} from './target/settings';
import { targetTraceRoute, targetTracesRoute } from './target/traces';
import { withHeaderRoute } from './with-header';

// Every route sits under the parent its `getParentRoute` names. The router derives paths and
// matches from `getParentRoute`, so this tree must agree with it or the two disagree silently.
export const routeTree = root.addChildren([
  notFoundRoute,
  logoutRoute,
  joinOrganizationRoute,
  anonymousRoute.addChildren([
    authRoute.addChildren([
      authIndexRoute,
      authResetPasswordRoute,
      authSignInRoute,
      authSignUpRoute,
      authSSORoute,
      authOIDCRoute,
      authCallbackRoute,
      authVerifyEmailRoute,
    ]),
  ]),
  authenticatedRoute.addChildren([
    indexRoute,
    nativeCompositionDiffRoute,
    newOrgPage,
    manageRoute,
    transferOrganizationRoute,
    withHeaderRoute.addChildren([
      organizationOIDCRequestRoute,
      organizationRoute.addChildren([
        organizationIndexRoute,
        organizationSupportRoute,
        organizationSupportTicketRoute,
        organizationSubscriptionRoute,
        organizationSubscriptionManageRoute,
        organizationMembersRoute.addChildren([
          organizationMembersIndexRoute,
          organizationMembersRolesRoute,
          organizationMembersGroupsRoute,
          organizationMembersInvitationsRoute,
        ]),
        organizationSettingsRoute.addChildren([
          organizationSettingsIndexRoute,
          organizationSettingsSsoRoute,
          organizationSettingsPolicyRoute,
          organizationSettingsAccessTokensRoute,
          organizationSettingsPersonalAccessTokensRoute,
        ]),
        ...legacyRoutesUnder(organizationRoute),
      ]),
      projectRoute.addChildren([
        projectIndexRoute,
        projectSettingsRoute.addChildren([
          projectSettingsIndexRoute,
          projectSettingsPolicyRoute,
          projectSettingsCompositionRoute,
          projectSettingsAccessTokensRoute,
        ]),
        projectAlertsRoute,
      ]),
      targetRoute.addChildren([
        targetIndexRoute,
        targetSettingsRoute.addChildren([
          targetSettingsIndexRoute,
          targetSettingsCdnRoute,
          targetSettingsRegistryTokenRoute,
          targetSettingsBreakingChangesRoute,
          targetSettingsBaseSchemaRoute,
          targetSettingsSchemaContractsRoute,
        ]),
        targetLaboratoryRoute,
        targetHistoryRoute.addChildren([targetHistoryIndexRoute, targetHistoryVersionRoute]),
        targetInsightsRoute,
        targetInsightsManageFiltersRoute,
        targetTraceRoute,
        targetTracesRoute,
        targetInsightsCoordinateRoute,
        targetInsightsClientRoute,
        targetInsightsOperationsRoute,
        targetExplorerRoute,
        targetExplorerDeprecatedRoute,
        targetExplorerUnusedRoute,
        targetExplorerTypeRoute,
        targetChecksRoute.addChildren([targetChecksSingleRoute]),
        targetChecksAffectedDeploymentsRoute,
        targetAppVersionRoute,
        targetAppsRoute,
        targetProposalsRoute,
        targetProposalsNewRoute,
        targetProposalsSingleRoute,
        targetAlertsRoute.addChildren([
          targetAlertsWithNavRoute.addChildren([
            targetAlertsIndexRoute,
            targetAlertsRulesRoute,
            targetAlertsCreateRoute,
          ]),
          targetAlertsDetailRoute,
          ...legacyRoutesUnder(targetAlertsRoute),
        ]),
        ...legacyRoutesUnder(targetRoute),
      ]),
    ]),
  ]),
]);
