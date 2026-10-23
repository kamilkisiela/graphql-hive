// @vitest-environment jsdom
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { PROPOSAL, proposalsFixtures } from '@/lib/testing/fixtures/proposals';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { screen, waitFor } from '@testing-library/react';

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

const PROPOSALS = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}/proposals`;
const LIST = 'listProposals';
const PROPOSAL_DOCUMENT = 'ProposalQuery';

type TestClient = ReturnType<typeof createTestClient>;

function client() {
  return createTestClient(new Map([...layoutFixtures(), ...proposalsFixtures()]));
}

function requestsOf(client: TestClient, name: string) {
  return client.requests(name).map(o => [o.variables, o.context.requestPolicy]);
}

async function loadedAt(url: string) {
  const testClient = client();
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: testClient,
  });
  await router.load();
  return Object.assign(testClient, { router });
}

describe('proposals route', () => {
  it('starts the list with the default stages, revalidating', { timeout: 30_000 }, async () => {
    const testClient = await loadedAt(PROPOSALS);

    expect(requestsOf(testClient, LIST)).toEqual([
      [
        { input: { target: { bySelector: SLUGS }, stages: ['APPROVED', 'DRAFT', 'OPEN'] } },
        'cache-and-network',
      ],
    ]);
  });

  it(
    'carries the stage filter from the URL, upper-cased and sorted',
    { timeout: 30_000 },
    async () => {
      const stage = encodeURIComponent(JSON.stringify(['open', 'draft']));
      const testClient = await loadedAt(`${PROPOSALS}?stage=${stage}`);

      expect(requestsOf(testClient, LIST)[0]?.[0]).toMatchObject({
        input: { stages: ['DRAFT', 'OPEN'] },
      });
    },
  );

  it('renders the list from the cache with no load more', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(PROPOSALS, { client: testClient });

    await screen.findByText(PROPOSAL.title);
    expect(testClient.requests(LIST)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('proposal route', () => {
  it(
    'starts the proposal with its version and timestamp, and leaves the changes to the page',
    { timeout: 30_000 },
    async () => {
      const testClient = await loadedAt(`${PROPOSALS}/${PROPOSAL.id}?version=v2&ts=123`);

      // The cache strips `timestamp`, which the document does not declare, from the request it
      // forwards; the request key still carries it.
      const [request] = testClient.requests(PROPOSAL_DOCUMENT);
      expect(request.variables).toEqual({
        projectRef: {
          bySelector: { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug },
        },
        targetRef: { bySelector: SLUGS },
        id: PROPOSAL.id,
        version: 'v2',
      });
      expect(['cache-and-network', 'network-only']).toContain(request.context.requestPolicy);
      expect(testClient.seen).not.toContain('ProposalChanges');

      await testClient.router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/proposals/$proposalId',
        params: { ...SLUGS, proposalId: PROPOSAL.id },
        search: { version: 'v2', ts: 124 },
      });
      await waitFor(() => expect(testClient.requests(PROPOSAL_DOCUMENT)).toHaveLength(2));
    },
  );
});
