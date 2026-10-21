// @vitest-environment jsdom
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { targetSettings } from '@/lib/testing/fixtures/target-settings';
import { createAppRouter } from '@/router';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
// The polyfills renderAtUrl installs, without its test client.
import '@/lib/testing/router';

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

// The one spec on the app's own client, exchanges and all, with fetch answering by operation
// name: the updater's refetch has to reach the subscribed table through that chain, not only
// through the test client.
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const token = (id: string) => ({
  __typename: 'CdnAccessToken',
  id,
  firstCharacters: 'hv2ab',
  lastCharacters: 'yz==',
  alias: id,
  createdAt: '2026-09-27T10:00:00.000Z',
});

function page(ids: string[], after: string | null) {
  return {
    __typename: 'Query',
    target: {
      __typename: 'Target',
      id: 'target-1',
      cdnAccessTokens: {
        __typename: 'TargetCdnAccessTokenConnection',
        edges: ids.map(id => ({ __typename: 'TargetCdnAccessTokenEdge', node: token(id) })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: after === null,
          hasPreviousPage: after !== null,
          endCursor: after === null ? 'c1' : null,
        },
      },
    },
  };
}

describe('CDN tokens through the real client', () => {
  it('refetches the open page after a create, through the modal', { timeout: 30_000 }, async () => {
    const pageTwo = ['old-1', 'old-2'];
    const fixtures = new Map<string, unknown>([
      ...layoutFixtures(),
      ['TargetSettingsPageQuery', targetSettings()],
      [
        'CDNAccessTokensQuery',
        (variables: { after: string | null }) =>
          variables.after === null ? page(['p1-a'], null) : page(pageTwo, variables.after),
      ],
      [
        'CDNAccessTokens_CDNAccessTokenCreateMutation',
        () => {
          pageTwo.unshift('new-1');
          return {
            __typename: 'Mutation',
            createCdnAccessToken: {
              __typename: 'CdnAccessTokenCreateResult',
              error: null,
              ok: {
                __typename: 'CdnAccessTokenCreateResultOk',
                secretAccessToken: 'secret',
                createdCdnAccessToken: token('new-1'),
              },
            },
          };
        },
      ],
    ]);
    const seen: string[] = [];
    globalThis.fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        operationName: string;
        variables: Record<string, unknown>;
      };
      seen.push(body.operationName);
      const fixture = fixtures.get(body.operationName);
      const data = typeof fixture === 'function' ? fixture(body.variables) : fixture;
      await new Promise(resolve => setTimeout(resolve, 5));
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const { urqlClient } = await import('@/lib/urql');
    const router = createAppRouter({
      history: createMemoryHistory({
        initialEntries: [
          `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}/settings/cdn`,
        ],
      }),
      urqlClient,
    });
    render(<RouterProvider router={router} />);
    await screen.findByText('p1-a');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('old-1');

    // Through the modal, as a user does: open it from the page, fill the alias, submit.
    fireEvent.click(screen.getByRole('link', { name: 'Create new CDN token' }));
    const alias = await screen.findByLabelText('CDN Access Token Alias');
    await act(async () => {
      fireEvent.change(alias, { target: { value: 'new-1' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });
    await screen.findByText('secret');

    await waitFor(() =>
      expect(seen.filter(name => name === 'CDNAccessTokensQuery')).toHaveLength(3),
    );
    expect(await screen.findByText('new-1', {}, { timeout: 2000 })).toBeTruthy();
  });
});
