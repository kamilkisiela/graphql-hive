// @vitest-environment jsdom
import { overviewPeriod } from '@/lib/overview-period';
import { layoutFixtures, organizationLayout, SLUGS } from '@/lib/testing/fixtures/layouts';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { UTCDate } from '@date-fns/utc';
import { createMemoryHistory } from '@tanstack/react-router';
import { waitFor } from '@testing-library/react';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
vi.mock('@/components/schema-editor', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/schema-editor')>()),
  SchemaEditor: () => null,
}));
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

// Stripe is off unless a spec turns it on.
const stripe = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/lib/billing/stripe-public-key', () => ({
  getStripePublicKey: () => (stripe.enabled ? 'pk_test' : null),
  getIsStripeEnabled: () => stripe.enabled,
}));

const ORGANIZATION = `/${SLUGS.organizationSlug}`;
const NOW = '2026-09-28T15:30:00.000Z';

type TestClient = ReturnType<typeof createTestClient>;

async function loadedAt(url: string, fixtures = layoutFixtures()) {
  const client = createTestClient(fixtures);
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

function variablesOf(client: TestClient, name: string) {
  return client.requests(name).map(o => o.variables);
}

// A revalidating request whose organization the layout already cached is a partial hit, which
// graphcache forwards as network-only.
function expectRevalidating(client: TestClient, name: string) {
  for (const operation of client.requests(name)) {
    expect(['cache-and-network', 'network-only']).toContain(operation.context.requestPolicy);
  }
}

describe('organization overview route', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the projects with the 14-day window, revalidating', { timeout: 30_000 }, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const { client } = await loadedAt(ORGANIZATION);

    const { period, resolution } = overviewPeriod(new UTCDate(NOW));
    expect(variablesOf(client, 'OrganizationProjectsPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug, chartResolution: resolution, period },
    ]);
    expectRevalidating(client, 'OrganizationProjectsPageQuery');
  });

  it('asks for a week on a plan that keeps a week', { timeout: 30_000 }, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const fixtures = layoutFixtures();
    fixtures.set('OrganizationLayoutQuery', organizationLayout({ usageRetentionInDays: 7 }));
    const { client } = await loadedAt(ORGANIZATION, fixtures);

    const { period, resolution } = overviewPeriod(new UTCDate(NOW), 7);
    expect(variablesOf(client, 'OrganizationProjectsPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug, chartResolution: 7, period },
    ]);
    expect(resolution).toBe(7);
  });
});

describe('support routes', () => {
  it('start the page and a ticket with their variables', { timeout: 30_000 }, async () => {
    const support = await loadedAt(`${ORGANIZATION}/view/support`);
    expect(variablesOf(support.client, 'SupportPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug },
    ]);

    const ticket = await loadedAt(`${ORGANIZATION}/view/support/ticket/ticket-1`);
    expect(variablesOf(ticket.client, 'SupportTicketPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug, ticketId: 'ticket-1' },
    ]);
  });
});

describe('subscription routes', () => {
  afterEach(() => {
    stripe.enabled = false;
  });

  it.each(['/view/subscription', '/view/subscription/manage'])(
    '%s is the organization without Stripe, replacing the entry and starting nothing',
    { timeout: 30_000 },
    async path => {
      const { client, router } = await loadedAt(`${ORGANIZATION}${path}`);

      await waitFor(() => expect(router.state.location.pathname).toBe(ORGANIZATION));
      expect(router.history.length).toBe(1);
      expect(client.seen).not.toContain('SubscriptionPageQuery');
      expect(client.seen).not.toContain('ManageSubscriptionPageQuery');
    },
  );

  it('start their documents with Stripe on', { timeout: 30_000 }, async () => {
    stripe.enabled = true;
    const subscription = await loadedAt(`${ORGANIZATION}/view/subscription`);
    expect(subscription.router.state.location.pathname).toBe(`${ORGANIZATION}/view/subscription`);
    expect(variablesOf(subscription.client, 'SubscriptionPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug },
    ]);

    const manage = await loadedAt(`${ORGANIZATION}/view/subscription/manage`);
    expect(variablesOf(manage.client, 'ManageSubscriptionPageQuery')).toEqual([
      { organizationSlug: SLUGS.organizationSlug },
    ]);
    expect(manage.client.requests('ManageSubscription_BillingPlans')).toHaveLength(1);
  });
});
