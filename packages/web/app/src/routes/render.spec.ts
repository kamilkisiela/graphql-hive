// @vitest-environment jsdom
import { CDNAccessTokenCreateMutation } from '@/components/target/settings/cdn-access-tokens';
import { CHECKS, checksFixtures } from '@/lib/testing/fixtures/checks';
import {
  layoutFixtures,
  organizationLayout,
  projectLayout,
  SLUGS,
  targetLayout,
} from '@/lib/testing/fixtures/layouts';
import { organizationMembers } from '@/lib/testing/fixtures/organization-members';
import { organizationSettings } from '@/lib/testing/fixtures/organization-settings';
import { projectSettings } from '@/lib/testing/fixtures/project-settings';
import { targetSettings } from '@/lib/testing/fixtures/target-settings';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
// The lazily loaded schema editor resolves to Monaco, which has no DOM to mount into here.
vi.mock('@/components/schema-editor', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/schema-editor')>()),
  SchemaEditor: () => null,
}));
// ECharts draws on a canvas, which jsdom does not implement.
vi.mock('@/components/ui/primitives/chart/chart', () => ({ Chart: () => null }));

// A signed-in session that never refreshes.
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));
// The OIDC interstitial redirects away unless the provider is on.
vi.mock('@/lib/auth/providers', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth/providers')>()),
  isProviderEnabled: () => true,
}));

// The layout queries are answered; every other query stays in flight, so pages show their loading
// branch and the chrome around them is what gets asserted.
const client = { current: null as null | ReturnType<typeof createTestClient> };
const at = (url: string) => renderAtUrl(url, { client: client.current! });

const TARGET = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;
const PROJECT = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}`;
const ORGANIZATION = `/${SLUGS.organizationSlug}`;

/** Every URL the chrome is asserted on, with the secondary item that must be current there. */
const pages: Array<{ url: string; current: string }> = [
  { url: ORGANIZATION, current: 'Overview' },
  { url: `${ORGANIZATION}?search=gate&sortBy=name`, current: 'Overview' },
  { url: `${ORGANIZATION}/view/members`, current: 'Members' },
  { url: `${ORGANIZATION}/view/settings`, current: 'Settings' },
  { url: `${ORGANIZATION}/view/support`, current: 'Support' },
  { url: `${ORGANIZATION}/view/support/ticket/ticket-1`, current: 'Support' },
  // The subscription pages redirect to the overview while Stripe is disabled, as it is here.
  { url: PROJECT, current: 'Targets' },
  { url: `${PROJECT}/view/alerts`, current: 'Alerts' },
  { url: `${PROJECT}/view/settings`, current: 'Settings' },
  { url: TARGET, current: 'Schema' },
  { url: `${TARGET}?service=users`, current: 'Schema' },
  { url: `${TARGET}/checks`, current: 'Checks' },
  { url: `${TARGET}/checks/check-1`, current: 'Checks' },
  { url: `${TARGET}/explorer/unused`, current: 'Explorer' },
  { url: `${TARGET}/insights`, current: 'Insights' },
  { url: `${TARGET}/apps`, current: 'Apps' },
  { url: `${TARGET}/history`, current: 'History' },
  { url: `${TARGET}/history/version-42`, current: 'History' },
  { url: `${TARGET}/insights/manage-filters`, current: 'Insights' },
  { url: `${TARGET}/insights/schema-coordinate/Query.me`, current: 'Insights' },
  { url: `${TARGET}/insights/client/web`, current: 'Insights' },
  { url: `${TARGET}/insights/GetUser/abc123`, current: 'Insights' },
  { url: `${TARGET}/traces`, current: 'Traces' },
  { url: `${TARGET}/traces/trace-1`, current: 'Traces' },
  { url: `${TARGET}/explorer`, current: 'Explorer' },
  { url: `${TARGET}/explorer/deprecated`, current: 'Explorer' },
  { url: `${TARGET}/explorer/User`, current: 'Explorer' },
  { url: `${TARGET}/checks/check-1/affected-deployments`, current: 'Checks' },
  { url: `${TARGET}/apps/app/1.0.0`, current: 'Apps' },
  { url: `${TARGET}/laboratory`, current: 'Laboratory' },
  { url: `${TARGET}/proposals`, current: 'Proposals' },
  { url: `${TARGET}/proposals/new`, current: 'Proposals' },
  { url: `${TARGET}/proposals/proposal-1`, current: 'Proposals' },
  { url: `${TARGET}/alerts`, current: 'Alerts' },
  { url: `${TARGET}/alerts/rules`, current: 'Alerts' },
  { url: `${TARGET}/alerts/activity`, current: 'Alerts' },
  { url: `${TARGET}/alerts/create`, current: 'Alerts' },
  { url: `${TARGET}/alerts/rule-1`, current: 'Alerts' },
  { url: `${TARGET}/settings`, current: 'Settings' },
];

describe('chrome at every page', () => {
  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
    // The laboratory greets a first visit with a modal, which hides the chrome from role queries.
    localStorage.setItem('hive:laboratory:welcome-dialog-shown', 'true');
  });

  // The header is owned by the layout route, so moving between sibling pages keeps the same DOM
  // node; a remount would create a new one.
  it('keeps the organization layout mounted across its pages', { timeout: 30_000 }, async () => {
    const { router } = at(ORGANIZATION);
    const header = await screen.findByRole('banner');
    await router.navigate({
      to: '/$organizationSlug/view/members',
      params: { organizationSlug: SLUGS.organizationSlug },
      search: { page: 'list' },
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${ORGANIZATION}/view/members`),
    );
    await screen.findByRole('link', { name: 'Members', current: 'page' });
    expect(screen.getByRole('banner')).toBe(header);
  });

  it('keeps the target layout mounted across its pages', { timeout: 30_000 }, async () => {
    const { router } = at(`${TARGET}/checks`);
    const header = await screen.findByRole('banner');
    await router.navigate({
      to: '/$organizationSlug/$projectSlug/$targetSlug/insights',
      params: SLUGS,
      search: {},
    });
    await screen.findByRole('link', { name: 'Insights', current: 'page' });
    expect(screen.getByRole('banner')).toBe(header);
  });

  it('keeps a target without versions on the history list', { timeout: 30_000 }, async () => {
    client.current!.fixtures.set('TargetLayoutQuery', targetLayout({ latestSchemaVersion: null }));
    client.current!.fixtures.set('TargetHistoryPageQuery', {
      __typename: 'Query',
      target: {
        __typename: 'Target',
        id: 'target-1',
        project: { __typename: 'Project', id: 'project-1', type: 'SINGLE' },
        latestSchemaVersion: null,
      },
    });
    const { router } = at(`${TARGET}/history`);
    await screen.findByText(/waiting for your first/);
    expect(router.state.location.pathname).toBe(`${TARGET}/history`);
    expect(client.current!.seen).not.toContain('TargetHistoryLatestVersionQuery');
  });

  // The layout document carries latestSchemaVersion, so the redirect is a cache read, not a request.
  it('sends the bare history URL to the latest version', { timeout: 30_000 }, async () => {
    const { router } = at(`${TARGET}/history`);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${TARGET}/history/version-42`),
    );
    expect(router.history.length).toBe(1);
    expect(client.current!.seen).not.toContain('TargetHistoryLatestVersionQuery');
  });

  it('keeps the project layout mounted across its pages', { timeout: 30_000 }, async () => {
    const { router } = at(PROJECT);
    const header = await screen.findByRole('banner');
    await router.navigate({
      to: '/$organizationSlug/$projectSlug/view/alerts',
      params: { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug },
    });
    await screen.findByRole('link', { name: 'Alerts', current: 'page' });
    expect(screen.getByRole('banner')).toBe(header);
  });

  it('keeps the header mounted across levels', { timeout: 30_000 }, async () => {
    const { router } = at(TARGET);
    const header = await screen.findByRole('banner');
    await router.navigate({
      to: '/$organizationSlug/$projectSlug',
      params: { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug },
    });
    await screen.findByRole('link', { name: 'Targets', current: 'page' });
    await router.navigate({
      to: '/$organizationSlug',
      params: { organizationSlug: SLUGS.organizationSlug },
    });
    await screen.findByRole('link', { name: 'Overview', current: 'page' });
    expect(screen.getByRole('banner')).toBe(header);
  });

  // On the interstitial the organization query answers NEEDS_OIDC, which reloads the page.
  it(
    'renders the header on the OIDC interstitial without asking for the organization',
    { timeout: 30_000 },
    async () => {
      at(`${ORGANIZATION}/oidc-request?id=oidc-1&redirectToPath=%2F`);
      await screen.findByRole('banner');
      expect(screen.getByRole('combobox', { name: /organization/i })).toBeTruthy();
      expect(client.current!.seen).toContain('ViewerQuery');
      expect(client.current!.seen).not.toContain('UserMenu_OrganizationQuery');
    },
  );

  // The viewer is one request per session; each level fetches only its entity document.
  it('loads the viewer once for the session', { timeout: 30_000 }, async () => {
    const { router } = at(TARGET);
    await screen.findByRole('banner');
    await router.navigate({
      to: '/$organizationSlug/$projectSlug',
      params: { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug },
    });
    await screen.findByRole('link', { name: 'Targets', current: 'page' });
    await router.navigate({
      to: '/$organizationSlug',
      params: { organizationSlug: SLUGS.organizationSlug },
    });
    await screen.findByRole('link', { name: 'Overview', current: 'page' });
    // Leaving the header route and coming back mounts it again; the viewer is still fresh.
    await router.navigate({ to: '/' });
    await waitFor(() => expect(screen.queryByRole('banner')).toBeNull());
    await router.navigate({
      to: '/$organizationSlug',
      params: { organizationSlug: SLUGS.organizationSlug },
    });
    await screen.findByRole('link', { name: 'Overview', current: 'page' });

    const seen = client.current!.seen;
    expect(seen.filter(name => name === 'ViewerQuery')).toHaveLength(1);
    expect(seen).toContain('ProjectLayoutQuery');
    expect(seen).toContain('OrganizationLayoutQuery');
  });

  it('shows the user menu for the current organization', { timeout: 30_000 }, async () => {
    at(ORGANIZATION);
    // The trigger pulses until the current organization is known.
    await waitFor(() =>
      expect(document.querySelector('[data-cy="user-menu-trigger"]')?.className).not.toContain(
        'animate-pulse',
      ),
    );
    // The layout document already holds every field the menu selects, so the menu reads the cache.
    expect(client.current!.seen).not.toContain('UserMenu_OrganizationQuery');
  });

  it('renders a missing page inside the chrome, not over it', { timeout: 30_000 }, async () => {
    at(`${TARGET}/nope`);
    const heading = await screen.findByText('Page Not Found');
    expect(screen.getByRole('navigation', { name: 'Secondary' })).toBeTruthy();
    // `h-screen` here would push the 404 a header's height past the bottom of the window.
    expect(heading.closest('.h-screen')).toBeNull();
  });

  for (const page of pages) {
    it(`${page.url}: one secondary nav, ${page.current} current`, { timeout: 30_000 }, async () => {
      at(page.url);

      await waitFor(() =>
        expect(document.querySelectorAll('nav[aria-label="Secondary"]')).toHaveLength(1),
      );
      // Scoped to the secondary nav: the header's selector links prefix every URL too.
      const nav = screen.getByRole('navigation', { name: 'Secondary' });
      const current = within(nav)
        .getAllByRole('link')
        .filter(link => link.getAttribute('aria-current') === 'page')
        .map(link => link.textContent);
      expect(current).toEqual([page.current]);
      expect(screen.queryByText('Oops, something went wrong.')).toBeNull();
      expect(screen.queryByText('Page Not Found')).toBeNull();
    });
  }
});

/** The labels of a tertiary nav's links and the one that is current, once it has rendered. */
async function sectionNav(name = 'Settings') {
  const nav = await screen.findByRole('navigation', { name });
  const links = within(nav).getAllByRole('link');
  return {
    labels: links.map(link => link.textContent),
    current: links.find(link => link.getAttribute('aria-current') === 'page')?.textContent,
  };
}

describe('target settings sections', () => {
  const SETTINGS = `${TARGET}/settings`;

  // A permission the layout document also selects is flipped on both, as one entity in the cache.
  function renderSettings(url: string, fixture = targetSettings(), layout?: unknown) {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set('TargetSettingsPageQuery', fixture);
    if (layout) {
      client.current.fixtures.set('TargetLayoutQuery', layout);
    }
    return at(url);
  }

  it(
    'renders General at the bare URL, with only General current',
    { timeout: 30_000 },
    async () => {
      renderSettings(SETTINGS);
      expect(await sectionNav()).toEqual({
        labels: [
          'General',
          'Breaking Changes',
          'Schema Contracts',
          'Registry Tokens',
          'CDN Tokens',
        ],
        current: 'General',
      });
      expect(await screen.findByText('Target ID')).toBeTruthy();
    },
  );

  it('renders a section at its path and keeps the data-cy hooks', { timeout: 30_000 }, async () => {
    renderSettings(`${SETTINGS}/cdn`);
    expect((await sectionNav()).current).toBe('CDN Tokens');
    expect(await screen.findByText('CDN Access Token')).toBeTruthy();
    expect(document.querySelector('[data-cy="target-settings-registry-token-link"]')).toBeTruthy();
  });

  it(
    'offers Base Schema instead of Schema Contracts outside federation',
    { timeout: 30_000 },
    async () => {
      renderSettings(`${SETTINGS}/base-schema`, targetSettings({ projectType: 'SINGLE' }));
      expect(await sectionNav()).toEqual({
        labels: ['General', 'Base Schema', 'Breaking Changes', 'Registry Tokens', 'CDN Tokens'],
        current: 'Base Schema',
      });
    },
  );

  it('hides sections the viewer may not open', { timeout: 30_000 }, async () => {
    renderSettings(
      `${SETTINGS}/registry-token`,
      targetSettings({ viewerCanModifyCDNAccessToken: false }),
    );
    expect((await sectionNav()).labels).toEqual([
      'General',
      'Breaking Changes',
      'Schema Contracts',
      'Registry Tokens',
    ]);
  });

  it(
    'sends a viewer who may not open General to their first section',
    { timeout: 30_000 },
    async () => {
      const { router } = renderSettings(
        SETTINGS,
        targetSettings({ viewerCanModifySettings: false }),
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(`${SETTINGS}/registry-token`),
      );
      expect((await sectionNav()).current).toBe('Registry Tokens');
    },
  );

  it('sends a viewer with no section at all back to the target', { timeout: 30_000 }, async () => {
    const { router } = renderSettings(
      `${SETTINGS}/cdn`,
      targetSettings({
        viewerCanModifySettings: false,
        viewerCanModifyCDNAccessToken: false,
        viewerCanModifyTargetAccessToken: false,
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(TARGET));
  });

  it('sends a viewer without settings access back to the target', { timeout: 30_000 }, async () => {
    const { router } = renderSettings(
      SETTINGS,
      targetSettings({ viewerCanAccessSettings: false }),
      targetLayout({ viewerCanAccessSettings: false }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(TARGET));
    expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull();
    // The page and the section both awaited and redirected; one request, no error boundary.
    expect(screen.queryByText('Oops, something went wrong.')).toBeNull();
    expect(client.current!.requests('TargetSettingsPageQuery')).toHaveLength(1);
  });

  it(
    'loads the page document once for the page and its section, and warms the section',
    { timeout: 30_000 },
    async () => {
      client.current = createTestClient(layoutFixtures());
      client.current.fixtures.set('TargetSettingsPageQuery', targetSettings());
      client.current.fixtures.set('CDNAccessTokensQuery', new Promise(() => {}));
      at(`${SETTINGS}/cdn`);
      await screen.findByText('CDN Access Token');

      const seen = client.current.seen;
      expect(seen.filter(name => name === 'TargetSettingsPageQuery')).toHaveLength(1);
      const cdn = client.current.requests('CDNAccessTokensQuery');
      expect(cdn.map(operation => operation.variables)).toEqual([
        { selector: SLUGS, first: 10, after: null },
      ]);
    },
  );

  it(
    'shows a CDN token in the open page right after it is created',
    { timeout: 30_000 },
    async () => {
      const tokens = ['token-1'];
      const token = (id: string) => ({
        __typename: 'CdnAccessToken' as const,
        id,
        firstCharacters: 'hv2ab',
        lastCharacters: 'yz==',
        alias: id,
        createdAt: '2026-09-27T10:00:00.000Z',
      });
      client.current = createTestClient(layoutFixtures());
      client.current.fixtures.set('TargetSettingsPageQuery', targetSettings());
      // Answered on a later tick, as a network would, once the first page has rendered.
      let answered = false;
      const later = <T>(value: T) =>
        answered ? new Promise<T>(resolve => setTimeout(() => resolve(value), 10)) : value;
      client.current.fixtures.set('CDNAccessTokensQuery', () =>
        later({
          __typename: 'Query',
          target: {
            __typename: 'Target',
            id: 'target-1',
            cdnAccessTokens: {
              __typename: 'TargetCdnAccessTokenConnection',
              edges: tokens.map(id => ({
                __typename: 'TargetCdnAccessTokenEdge',
                node: token(id),
              })),
              pageInfo: {
                __typename: 'PageInfo',
                hasNextPage: false,
                hasPreviousPage: false,
                endCursor: null,
              },
            },
          },
        }),
      );
      client.current.fixtures.set('CDNAccessTokens_CDNAccessTokenCreateMutation', () => {
        tokens.unshift('token-2');
        return later({
          __typename: 'Mutation',
          createCdnAccessToken: {
            __typename: 'CdnAccessTokenCreateResult',
            error: null,
            ok: {
              __typename: 'CdnAccessTokenCreateResultOk',
              secretAccessToken: 'secret',
              createdCdnAccessToken: token('token-2'),
            },
          },
        });
      });
      at(`${SETTINGS}/cdn`);
      await screen.findByText('token-1');
      answered = true;

      await client.current
        .mutation(CDNAccessTokenCreateMutation, {
          input: { target: { bySelector: SLUGS }, alias: 'token-2' },
        })
        .toPromise();

      expect(await screen.findByText('token-2')).toBeTruthy();
      expect(client.current.seen.filter(name => name === 'CDNAccessTokensQuery')).toHaveLength(2);
    },
  );

  it('keeps the settings nav mounted from General to CDN', { timeout: 30_000 }, async () => {
    const { router } = renderSettings(SETTINGS);
    await screen.findByText('Target ID');
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    await router.navigate({
      to: '/$organizationSlug/$projectSlug/$targetSlug/settings/cdn',
      params: SLUGS,
    });
    await screen.findByText('CDN Access Token');
    expect(screen.getByRole('navigation', { name: 'Settings' })).toBe(nav);
  });
});

describe('organization settings sections', () => {
  const SETTINGS = `${ORGANIZATION}/view/settings`;

  // A permission the layout document also selects is flipped on both, as one entity in the cache.
  function renderSettings(url: string, fixture = organizationSettings(), layout?: unknown) {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set('OrganizationSettingsPageQuery', fixture);
    if (layout) {
      client.current.fixtures.set('OrganizationLayoutQuery', layout);
    }
    return at(url);
  }

  it(
    'renders General at the bare URL, with only General current',
    { timeout: 30_000 },
    async () => {
      renderSettings(SETTINGS);
      expect(await sectionNav()).toEqual({
        labels: ['General', 'Policy', 'SSO / SCIM', 'Access Tokens', 'Personal Access Tokens'],
        current: 'General',
      });
      expect(await screen.findByText('Organization ID')).toBeTruthy();
    },
  );

  it('renders a section at its path and keeps the data-cy hooks', { timeout: 30_000 }, async () => {
    renderSettings(`${SETTINGS}/policy`);
    expect((await sectionNav()).current).toBe('Policy');
    expect(await screen.findByText('Rules')).toBeTruthy();
    expect(document.querySelector('[data-cy="link-sso"]')).toBeTruthy();
  });

  it('hides sections the viewer may not open', { timeout: 30_000 }, async () => {
    renderSettings(
      SETTINGS,
      organizationSettings({
        viewerCanManageOIDCIntegration: false,
        viewerCanManagePersonalAccessTokens: false,
      }),
      organizationLayout({ viewerCanManagePersonalAccessTokens: false }),
    );
    expect((await sectionNav()).labels).toEqual(['General', 'Policy', 'Access Tokens']);
  });

  it('sends a viewer who may not open General to Policy', { timeout: 30_000 }, async () => {
    const { router } = renderSettings(
      SETTINGS,
      organizationSettings({ viewerCanAccessSettings: false }),
      organizationLayout({ viewerCanAccessSettings: false }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${SETTINGS}/policy`));
    expect((await sectionNav()).current).toBe('Policy');
  });
});

describe('project settings sections', () => {
  const SETTINGS = `${PROJECT}/view/settings`;

  // A permission the layout document also selects is flipped on both, as one entity in the cache.
  function renderSettings(url: string, fixture = projectSettings(), layout?: unknown) {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set('ProjectSettingsPageQuery', fixture);
    if (layout) {
      client.current.fixtures.set('ProjectLayoutQuery', layout);
    }
    return at(url);
  }

  it(
    'renders General at the bare URL, with only General current',
    { timeout: 30_000 },
    async () => {
      renderSettings(SETTINGS);
      expect(await sectionNav()).toEqual({
        labels: ['General', 'Policy', 'Composition', 'Access Tokens'],
        current: 'General',
      });
      expect(await screen.findByText('Project ID')).toBeTruthy();
    },
  );

  it('renders a section at its path', { timeout: 30_000 }, async () => {
    renderSettings(`${SETTINGS}/policy`);
    expect((await sectionNav()).current).toBe('Policy');
    expect(await screen.findByText('Rules')).toBeTruthy();
  });

  it('offers Composition only to federation projects', { timeout: 30_000 }, async () => {
    renderSettings(SETTINGS, projectSettings({ projectType: 'SINGLE' }));
    expect((await sectionNav()).labels).toEqual(['General', 'Policy', 'Access Tokens']);
  });

  it('sends a viewer who may not open General to Policy', { timeout: 30_000 }, async () => {
    const { router } = renderSettings(
      SETTINGS,
      projectSettings({ viewerCanModifySettings: false }),
      projectLayout({ viewerCanModifySettings: false }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(`${SETTINGS}/policy`));
    expect((await sectionNav()).current).toBe('Policy');
  });

  it(
    'sends a viewer without settings access back to the project',
    { timeout: 30_000 },
    async () => {
      // The gate reads the layout document; the page document describes the same project.
      const denied = { viewerCanModifySettings: false, viewerCanManageProjectAccessTokens: false };
      client.current = createTestClient(layoutFixtures());
      client.current.fixtures.set('ProjectLayoutQuery', projectLayout(denied));
      client.current.fixtures.set('ProjectSettingsPageQuery', projectSettings(denied));
      const { router } = at(`${SETTINGS}/policy`);
      await waitFor(() => expect(router.state.location.pathname).toBe(PROJECT));
    },
  );
});

describe('members sections', () => {
  const MEMBERS = `${ORGANIZATION}/view/members`;

  function renderMembers(url: string, fixture = organizationMembers()) {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set('OrganizationMembersPageQuery', fixture);
    return at(url);
  }

  it(
    'renders the list at the bare URL, keeping its search param',
    { timeout: 30_000 },
    async () => {
      const { router } = renderMembers(`${MEMBERS}?search=jo`);
      expect(await sectionNav('Members')).toEqual({
        labels: ['Members', 'Roles', 'Groups', 'Invitations'],
        current: 'Members',
      });
      expect(await screen.findByText('List of organization members')).toBeTruthy();
      expect(router.state.location.search).toEqual({ search: 'jo' });
    },
  );

  it('renders a section at its path', { timeout: 30_000 }, async () => {
    renderMembers(`${MEMBERS}/roles`);
    expect((await sectionNav('Members')).current).toBe('Roles');
    expect(await screen.findByText('List of roles')).toBeTruthy();
  });

  it(
    'hides sections the viewer may not open and sends them to the list',
    { timeout: 30_000 },
    async () => {
      const { router } = renderMembers(
        `${MEMBERS}/invitations`,
        organizationMembers({ viewerCanManageInvitations: false, viewerCanManageRoles: false }),
      );
      await waitFor(() => expect(router.state.location.pathname).toBe(MEMBERS));
      expect((await sectionNav('Members')).labels).toEqual(['Members', 'Groups']);
    },
  );

  it(
    'sends a viewer who may not see members back to the organization',
    { timeout: 30_000 },
    async () => {
      // The gate reads the layout document; the page document describes the same organization.
      client.current = createTestClient(layoutFixtures());
      client.current.fixtures.set(
        'OrganizationLayoutQuery',
        organizationLayout({ viewerCanSeeMembers: false }),
      );
      client.current.fixtures.set(
        'OrganizationMembersPageQuery',
        organizationMembers({ viewerCanSeeMembers: false }),
      );
      const { router } = at(MEMBERS);
      await waitFor(() => expect(router.state.location.pathname).toBe(ORGANIZATION));
    },
  );
});

describe('alerts sections', () => {
  const ALERTS = `${TARGET}/alerts`;

  function renderAlerts(url: string, viewerCanUseMetricAlertRules = true) {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set(
      'TargetLayoutQuery',
      targetLayout({ viewerCanUseMetricAlertRules }),
    );
    return at(url);
  }

  it(
    'renders Activity at the bare URL, with only Activity current',
    { timeout: 30_000 },
    async () => {
      renderAlerts(ALERTS);
      expect(await sectionNav('Alerts')).toEqual({
        labels: ['Alert activity', 'Alert rules', 'Create a new alert'],
        current: 'Alert activity',
      });
    },
  );

  it('renders a section at its path', { timeout: 30_000 }, async () => {
    renderAlerts(`${ALERTS}/rules`);
    expect((await sectionNav('Alerts')).current).toBe('Alert rules');
  });

  it('renders the rule detail without the alerts nav', { timeout: 30_000 }, async () => {
    renderAlerts(`${ALERTS}/rule-1`);
    await screen.findByRole('link', { name: 'Alerts', current: 'page' });
    expect(screen.queryByRole('navigation', { name: 'Alerts' })).toBeNull();
  });

  it('sends a viewer without alert rules back to the target', { timeout: 30_000 }, async () => {
    const { router } = renderAlerts(`${ALERTS}/rules`, false);
    await waitFor(() => expect(router.state.location.pathname).toBe(TARGET));
  });

  it(
    'reads the permission from the layout, not a document of its own',
    { timeout: 30_000 },
    async () => {
      renderAlerts(ALERTS);
      await sectionNav('Alerts');
      const seen = client.current!.seen;
      expect(seen.filter(name => name.endsWith('LayoutQuery'))).toEqual(['TargetLayoutQuery']);
    },
  );
});

describe('the range in the URL', () => {
  // Alerts is a period page too, but its activity log has its own default and retention.
  const PERIOD_ITEMS = ['Explorer', 'Traces', 'Insights'];

  function navRange(name: string) {
    const nav = screen.getByRole('navigation', { name: 'Secondary' });
    const href = within(nav).getByRole('link', { name }).getAttribute('href') ?? '';
    return new URL(href, 'http://localhost').searchParams.get('from');
  }

  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
  });

  it('travels through the nav from a page that has one', { timeout: 30_000 }, async () => {
    at(`${TARGET}/insights?from=now-1d&to=now`);
    await screen.findByRole('link', { name: 'Insights', current: 'page' });

    for (const name of PERIOD_ITEMS) {
      expect(navRange(name)).toContain('now-1d');
    }
    expect(navRange('Alerts')).toBeNull();
    expect(navRange('Checks')).toBeNull();
  });

  it('is kept from Insights and Explorer when the retention does not cover it', async () => {
    // Traces keeps data for a year; the fixture organization keeps usage for 30 days.
    at(`${TARGET}/traces?from=now-90d&to=now`);
    await screen.findByRole('link', { name: 'Traces', current: 'page' });

    expect(navRange('Traces')).toContain('now-90d');
    expect(navRange('Insights')).toBeNull();
    expect(navRange('Explorer')).toBeNull();
  });

  it('is not invented by a page without one', { timeout: 30_000 }, async () => {
    at(`${TARGET}/checks`);
    await screen.findByRole('link', { name: 'Checks', current: 'page' });

    for (const name of PERIOD_ITEMS) {
      expect(navRange(name)).toBeNull();
    }
  });
});

describe('permission gates', () => {
  // Each gated URL and the layout flag that opens it. A route may start its page documents beside
  // the gate, so what a viewer without the flag never gets is the page, not the request.
  const gates = [
    [`${TARGET}/alerts/rules`, 'viewerCanUseMetricAlertRules'],
    [`${TARGET}/apps`, 'viewerCanViewAppDeployments'],
    [`${TARGET}/apps/app/1.0.0`, 'viewerCanViewAppDeployments'],
    [`${TARGET}/laboratory`, 'viewerCanViewLaboratory'],
    [`${TARGET}/proposals`, 'viewerCanViewSchemaProposals'],
    [`${TARGET}/proposals/new`, 'viewerCanViewSchemaProposals'],
    [`${TARGET}/proposals/proposal-1`, 'viewerCanViewSchemaProposals'],
  ] as const;

  beforeEach(() => {
    localStorage.setItem('hive:laboratory:welcome-dialog-shown', 'true');
  });

  it.each(gates)(
    '%s sends a viewer without %s to the target, replacing the entry',
    { timeout: 30_000 },
    async (url, flag) => {
      client.current = createTestClient(layoutFixtures());
      client.current.fixtures.set('TargetLayoutQuery', targetLayout({ [flag]: false }));
      const { router } = at(url);

      await waitFor(() => expect(router.state.location.pathname).toBe(TARGET));

      expect(router.history.length).toBe(1);
      expect(client.current.requests('TargetLayoutQuery')).toHaveLength(1);
    },
  );

  it.each(gates)(
    '%s reads %s from the layout request, adding none of its own',
    { timeout: 30_000 },
    async url => {
      const client = createTestClient(layoutFixtures());
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [url] }),
        urqlClient: client,
      });
      await router.load();

      expect(router.state.location.pathname).toBe(url);
      expect(client.requests('TargetLayoutQuery')).toHaveLength(1);
    },
  );
});

describe('read-once page loaders', () => {
  // Loaded but not rendered: the request can only have come from the route.
  it.each([
    [TARGET, 'TargetSchemaPageQuery', SLUGS],
    [
      `${TARGET}/proposals/new`,
      'ProposalsNewProposalQuery',
      { targetReference: { bySelector: SLUGS } },
    ],
  ])(
    '%s starts %s with the page variables before render',
    { timeout: 30_000 },
    async (url, name, variables) => {
      const client = createTestClient(layoutFixtures());
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [url] }),
        urqlClient: client,
      });
      await router.load();

      expect(client.requests(name).map(operation => operation.variables)).toEqual([variables]);
    },
  );
});

describe('layout loaders', () => {
  async function loadedAt(url: string) {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [url] }),
      urqlClient: client,
    });
    await router.load();
    return client;
  }

  // Loaded but not rendered: the requests can only have come from the loaders.
  it.each([
    [
      `${ORGANIZATION}/view/settings`,
      'OrganizationLayoutQuery',
      { organizationSlug: SLUGS.organizationSlug },
    ],
    [
      `${PROJECT}/view/settings`,
      'ProjectLayoutQuery',
      { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug },
    ],
    [`${TARGET}/checks/check-1`, 'TargetLayoutQuery', SLUGS],
  ])(
    '%s starts %s with exactly its layout variables before render',
    { timeout: 30_000 },
    async (url, name, variables) => {
      const client = await loadedAt(url);
      expect(client.seen).toContain('ViewerQuery');
      const operation = client.requests(name)[0];
      expect(operation?.variables).toEqual(variables);
    },
  );
});

describe('tables while they load', () => {
  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
    // The settings layouts gate their sections on these.
    client.current.fixtures.set('OrganizationSettingsPageQuery', organizationSettings());
    client.current.fixtures.set('ProjectSettingsPageQuery', projectSettings());
  });

  // Held in flight, as the page's own query is on a real first load.
  it.each([
    [`${TARGET}/apps`, 'TargetAppsViewQuery'],
    [`${TARGET}/alerts/rules`, 'TargetAlertsRulesPage_Query'],
    [`${ORGANIZATION}/view/settings/access-tokens`, 'AccessTokensSubPage_OrganizationQuery'],
    [
      `${ORGANIZATION}/view/settings/personal-access-tokens`,
      'PersonalAccessTokensSubPage_OrganizationQuery',
    ],
    [`${PROJECT}/view/settings/access-tokens`, 'ProjectAccessTokensSubPage_OrganizationQuery'],
  ])('%s shows skeleton rows, not a spinner', { timeout: 30_000 }, async (url, pageQuery) => {
    client.current!.fixtures.set(pageQuery, new Promise(() => {}));
    at(url);
    const status = await screen.findByRole('status', { name: 'Loading' });
    expect(status.closest('tbody')).not.toBeNull();
  });
});

describe('a failed page query', () => {
  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
    client.current.fixtures.set('OrganizationSettingsPageQuery', organizationSettings());
    client.current.fixtures.set('ProjectSettingsPageQuery', projectSettings());
  });

  it.each([
    [`${TARGET}/proposals`, 'listProposals'],
    [`${ORGANIZATION}/view/settings/access-tokens`, 'AccessTokensSubPage_OrganizationQuery'],
    [
      `${ORGANIZATION}/view/settings/personal-access-tokens`,
      'PersonalAccessTokensSubPage_OrganizationQuery',
    ],
    [`${PROJECT}/view/settings/access-tokens`, 'ProjectAccessTokensSubPage_OrganizationQuery'],
  ])(
    '%s shows the error, not a skeleton or an empty state',
    { timeout: 30_000 },
    async (url, pageQuery) => {
      client.current!.fixtures.set(pageQuery, new Error('the server is away'));
      at(url);
      await screen.findByText('Oops, something went wrong.');
      expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
      expect(screen.queryByText(/No .* yet\./)).toBeNull();
    },
  );

  it(
    'manage filters settles on its empty state for a target with none',
    { timeout: 30_000 },
    async () => {
      client.current!.fixtures.set('ManageFilters_SavedFiltersQuery', {
        __typename: 'Query',
        organization: {
          __typename: 'Organization',
          id: 'organization-1',
          usageRetentionInDays: 30,
        },
        target: null,
      });
      at(`${TARGET}/insights/manage-filters`);
      await screen.findByText('No saved filters');
      expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    },
  );
});

describe('insights', () => {
  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
  });

  const INSIGHTS = `${TARGET}/insights`;
  const emptyState = /waiting for your first collected operation/;

  it('shows nothing until its own query has answered', { timeout: 30_000 }, async () => {
    at(INSIGHTS);
    await screen.findByRole('link', { name: 'Insights', current: 'page' });
    expect(screen.queryByText(emptyState)).toBeNull();
  });

  it('shows the empty state for a target without operations', { timeout: 30_000 }, async () => {
    client.current!.fixtures.set('TargetOperationsPageQuery', {
      __typename: 'Query',
      hasCollectedOperations: false,
    });
    at(INSIGHTS);
    expect(await screen.findByText(emptyState)).toBeTruthy();
  });
});

describe('proposals', () => {
  beforeEach(() => {
    client.current = createTestClient(layoutFixtures());
  });

  it(
    'reads the permission from the layout, not a document of its own',
    { timeout: 30_000 },
    async () => {
      at(`${TARGET}/proposals`);
      await screen.findByRole('link', { name: 'Proposals', current: 'page' });
      const seen = client.current!.seen;
      expect(seen.filter(name => name.endsWith('LayoutQuery'))).toEqual(['TargetLayoutQuery']);
    },
  );
});

describe('hover preloading', () => {
  it(
    "runs a link's loaders on hover, so the click needs no request",
    { timeout: 30_000 },
    async () => {
      const testClient = createTestClient(new Map([...layoutFixtures(), ...checksFixtures()]));
      const { router } = renderAtUrl(TARGET, { client: testClient });
      const link = await screen.findByRole('link', { name: 'Checks' });

      fireEvent.mouseEnter(link);

      await waitFor(() => expect(testClient.seen).toContain('ChecksPageQuery'));
      expect(router.state.location.pathname).toBe(TARGET);
      const requests = testClient.seen.length;
      const preloaded = testClient.requests('ChecksPageQuery');
      expect(preloaded.map(operation => operation.context.preload)).toEqual([true]);

      fireEvent.click(link);

      await screen.findByText(CHECKS.first[0]);
      expect(testClient.seen).toHaveLength(requests);
    },
  );
});
