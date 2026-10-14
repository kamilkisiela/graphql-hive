// @vitest-environment jsdom
import { createTestClient } from '@/lib/testing/urql';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);

const T = '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug';
const O = '/authenticated/with-header/$organizationSlug';

/**
 * One example URL per route, keyed by the route id it must resolve to. Every id in the tree has to
 * appear here (asserted below), so adding a route without an example fails the suite.
 */
const examples: Record<string, string> = {
  '/404': '/404',
  '/logout': '/logout',
  '/join/$inviteCode': '/join/abc',
  '/anonymous/auth/': '/auth',
  '/anonymous/auth/sign-in': '/auth/sign-in',
  '/anonymous/auth/sign-up': '/auth/sign-up',
  '/anonymous/auth/sso': '/auth/sso',
  '/anonymous/auth/oidc': '/auth/oidc',
  '/anonymous/auth/reset-password': '/auth/reset-password',
  '/anonymous/auth/callback/$provider': '/auth/callback/github',
  '/anonymous/auth/verify-email': '/auth/verify-email',
  '/authenticated/': '/',
  '/authenticated/manage': '/manage',
  '/authenticated/org/new': '/org/new',
  '/authenticated/native-composition-compatibility-report/$projectId':
    '/native-composition-compatibility-report/p1',
  '/authenticated/action/transfer/$organizationSlug/$code': '/action/transfer/acme/code1',
  [`${O}/`]: '/acme',
  [`${O}/oidc-request`]: '/acme/oidc-request',
  [`${O}/view/support`]: '/acme/view/support',
  [`${O}/view/support/ticket/$ticketId`]: '/acme/view/support/ticket/t1',
  [`${O}/view/subscription`]: '/acme/view/subscription',
  [`${O}/view/subscription/manage`]: '/acme/view/subscription/manage',
  [`${O}/view/manage-subscription`]: '/acme/view/manage-subscription',
  [`${O}/view/members/`]: '/acme/view/members',
  [`${O}/view/members/roles`]: '/acme/view/members/roles',
  [`${O}/view/members/groups`]: '/acme/view/members/groups',
  [`${O}/view/members/invitations`]: '/acme/view/members/invitations',
  [`${O}/view/settings/`]: '/acme/view/settings',
  [`${O}/view/settings/sso`]: '/acme/view/settings/sso',
  [`${O}/view/settings/policy`]: '/acme/view/settings/policy',
  [`${O}/view/settings/access-tokens`]: '/acme/view/settings/access-tokens',
  [`${O}/view/settings/personal-access-tokens`]: '/acme/view/settings/personal-access-tokens',
  [`${O}/$projectSlug/`]: '/acme/shop',
  [`${O}/$projectSlug/view/settings/`]: '/acme/shop/view/settings',
  [`${O}/$projectSlug/view/settings/policy`]: '/acme/shop/view/settings/policy',
  [`${O}/$projectSlug/view/settings/composition`]: '/acme/shop/view/settings/composition',
  [`${O}/$projectSlug/view/settings/access-tokens`]: '/acme/shop/view/settings/access-tokens',
  [`${O}/$projectSlug/view/alerts`]: '/acme/shop/view/alerts',
  [`${T}/`]: '/acme/shop/prod',
  [`${T}/settings/`]: '/acme/shop/prod/settings',
  [`${T}/settings/cdn`]: '/acme/shop/prod/settings/cdn',
  [`${T}/settings/registry-token`]: '/acme/shop/prod/settings/registry-token',
  [`${T}/settings/breaking-changes`]: '/acme/shop/prod/settings/breaking-changes',
  [`${T}/settings/base-schema`]: '/acme/shop/prod/settings/base-schema',
  [`${T}/settings/schema-contracts`]: '/acme/shop/prod/settings/schema-contracts',
  [`${T}/laboratory`]: '/acme/shop/prod/laboratory',
  [`${T}/history/`]: '/acme/shop/prod/history',
  [`${T}/history/$versionId`]: '/acme/shop/prod/history/v1',
  [`${T}/insights`]: '/acme/shop/prod/insights',
  [`${T}/insights/manage-filters`]: '/acme/shop/prod/insights/manage-filters',
  [`${T}/insights/schema-coordinate/$coordinate`]:
    '/acme/shop/prod/insights/schema-coordinate/Query.me',
  [`${T}/insights/client/$name`]: '/acme/shop/prod/insights/client/web',
  [`${T}/insights/$operationName/$operationHash`]: '/acme/shop/prod/insights/GetUser/abc123',
  [`${T}/traces`]: '/acme/shop/prod/traces',
  [`${T}/trace/$traceId`]: '/acme/shop/prod/trace/t1',
  [`${T}/traces/$traceId`]: '/acme/shop/prod/traces/t1',
  [`${T}/explorer`]: '/acme/shop/prod/explorer',
  [`${T}/explorer/deprecated`]: '/acme/shop/prod/explorer/deprecated',
  [`${T}/explorer/unused`]: '/acme/shop/prod/explorer/unused',
  [`${T}/explorer/$typename`]: '/acme/shop/prod/explorer/User',
  [`${T}/checks`]: '/acme/shop/prod/checks',
  [`${T}/checks/$schemaCheckId`]: '/acme/shop/prod/checks/c1',
  [`${T}/checks/$schemaCheckId/affected-deployments`]:
    '/acme/shop/prod/checks/c1/affected-deployments',
  [`${T}/apps`]: '/acme/shop/prod/apps',
  [`${T}/apps/$appName/$appVersion`]: '/acme/shop/prod/apps/app/1.0.0',
  [`${T}/proposals`]: '/acme/shop/prod/proposals',
  [`${T}/proposals/new`]: '/acme/shop/prod/proposals/new',
  [`${T}/proposals/$proposalId`]: '/acme/shop/prod/proposals/pr1',
  [`${T}/alerts/with-nav/`]: '/acme/shop/prod/alerts',
  [`${T}/alerts/with-nav/rules`]: '/acme/shop/prod/alerts/rules',
  [`${T}/alerts/activity`]: '/acme/shop/prod/alerts/activity',
  [`${T}/alerts/with-nav/create`]: '/acme/shop/prod/alerts/create',
  [`${T}/alerts/$ruleId`]: '/acme/shop/prod/alerts/rule1',
};

describe('route tree', () => {
  async function build() {
    const { routeTree } = await import('./tree');
    return createRouter({
      routeTree,
      history: createMemoryHistory(),
      context: { urqlClient: createTestClient() },
    });
  }

  it('registers exactly these routes', { timeout: 30_000 }, async () => {
    const router = await build();
    expect(Object.keys(router.routesById).sort()).toMatchInlineSnapshot(`
      [
        /404,
        /anonymous,
        /anonymous/auth,
        /anonymous/auth/,
        /anonymous/auth/callback/$provider,
        /anonymous/auth/oidc,
        /anonymous/auth/reset-password,
        /anonymous/auth/sign-in,
        /anonymous/auth/sign-up,
        /anonymous/auth/sso,
        /anonymous/auth/verify-email,
        /authenticated,
        /authenticated/,
        /authenticated/action/transfer/$organizationSlug/$code,
        /authenticated/manage,
        /authenticated/native-composition-compatibility-report/$projectId,
        /authenticated/org/new,
        /authenticated/with-header,
        /authenticated/with-header/$organizationSlug,
        /authenticated/with-header/$organizationSlug/,
        /authenticated/with-header/$organizationSlug/$projectSlug,
        /authenticated/with-header/$organizationSlug/$projectSlug/,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/$ruleId,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/activity,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/with-nav,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/with-nav/,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/with-nav/create,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/alerts/with-nav/rules,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/apps,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/apps/$appName/$appVersion,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/checks,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/checks/$schemaCheckId,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/checks/$schemaCheckId/affected-deployments,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/explorer,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/explorer/$typename,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/explorer/deprecated,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/explorer/unused,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/history,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/history/,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/history/$versionId,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights/client/$name,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights/manage-filters,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/laboratory,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/proposals,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/proposals/new,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/base-schema,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/breaking-changes,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/cdn,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/registry-token,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/settings/schema-contracts,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/trace/$traceId,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/traces,
        /authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/traces/$traceId,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/alerts,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/settings,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/settings/,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/settings/access-tokens,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/settings/composition,
        /authenticated/with-header/$organizationSlug/$projectSlug/view/settings/policy,
        /authenticated/with-header/$organizationSlug/oidc-request,
        /authenticated/with-header/$organizationSlug/view/manage-subscription,
        /authenticated/with-header/$organizationSlug/view/members,
        /authenticated/with-header/$organizationSlug/view/members/,
        /authenticated/with-header/$organizationSlug/view/members/groups,
        /authenticated/with-header/$organizationSlug/view/members/invitations,
        /authenticated/with-header/$organizationSlug/view/members/roles,
        /authenticated/with-header/$organizationSlug/view/settings,
        /authenticated/with-header/$organizationSlug/view/settings/,
        /authenticated/with-header/$organizationSlug/view/settings/access-tokens,
        /authenticated/with-header/$organizationSlug/view/settings/personal-access-tokens,
        /authenticated/with-header/$organizationSlug/view/settings/policy,
        /authenticated/with-header/$organizationSlug/view/settings/sso,
        /authenticated/with-header/$organizationSlug/view/subscription,
        /authenticated/with-header/$organizationSlug/view/subscription/manage,
        /authenticated/with-header/$organizationSlug/view/support,
        /authenticated/with-header/$organizationSlug/view/support/ticket/$ticketId,
        /join/$inviteCode,
        /logout,
        __root__,
      ]
    `);
  });

  it('resolves every route from an example URL', { timeout: 30_000 }, async () => {
    const router = await build();
    const covered = new Set<string>();

    for (const [routeId, url] of Object.entries(examples)) {
      const matched = router.matchRoutes(url, {}).map(m => m.routeId);
      expect({ url, leaf: matched.at(-1) }).toEqual({ url, leaf: routeId });
      for (const id of matched) {
        covered.add(id);
      }
    }

    const uncovered = Object.keys(router.routesById).filter(id => !covered.has(id));
    expect(uncovered).toEqual([]);
  });

  // Slug params absorb any three leading segments, so an unknown deeper path stops at the target
  // route and its `notFoundComponent` renders the 404, rather than a page route matching by accident.
  it('stops unknown paths under a target at the target route', { timeout: 30_000 }, async () => {
    const router = await build();
    const matched = router.matchRoutes('/nope/x/y/z/404', {}).map(m => m.routeId);
    expect(matched.at(-1)).toBe(T);
  });
});
