// @vitest-environment jsdom
import { createElement } from 'react';
import { parse } from 'graphql';
import { Provider, useQuery } from 'urql';
import { filter, fromPromise, mergeMap, pipe } from 'wonka';
import { act, render, renderHook } from '@testing-library/react';
import { createClient, makeResult, type Exchange } from '@urql/core';
import { networkStatusExchange, useInflightRequests } from './state';

// Holds every answer until the test releases it, so "in flight" does not depend on timers; a
// delay-based answer raced the assertions on a loaded CI runner.
function heldClient() {
  let release = () => {};
  const held: Exchange = () => operations$ =>
    pipe(
      operations$,
      filter(operation => operation.kind !== 'teardown'),
      mergeMap(operation =>
        fromPromise(
          new Promise<void>(resolve => (release = resolve)).then(() =>
            makeResult(operation, { data: { __typename: 'Query' } }),
          ),
        ),
      ),
    );
  const client = createClient({
    url: 'http://test.invalid/graphql',
    exchanges: [networkStatusExchange, held],
  });
  return { client, release: () => release() };
}

const probe = parse('query Probe { __typename }');

// The store notifies asynchronously, so each step runs inside `act` for the hook to see it.
describe('networkStatusExchange', () => {
  it('counts a query while it is in flight and settles once it is answered', async () => {
    const { client, release } = heldClient();
    const { result } = renderHook(() => useInflightRequests());
    let done: Promise<unknown> | undefined;

    await act(async () => {
      done = client.query(probe, {}).toPromise();
    });
    expect(result.current).toBe(1);

    await act(async () => {
      release();
      await done;
    });
    expect(result.current).toBe(0);
  });

  it('ignores a preload', async () => {
    const { client, release } = heldClient();
    const { result } = renderHook(() => useInflightRequests());
    let done: Promise<unknown> | undefined;

    await act(async () => {
      done = client.query(probe, {}, { preload: true }).toPromise();
    });
    expect(result.current).toBe(0);

    await act(async () => {
      release();
      await done;
    });
    expect(result.current).toBe(0);
  });

  it('does not update a subscriber while another component renders a query', async () => {
    const { client, release } = heldClient();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let count = -1;
    function Indicator() {
      count = useInflightRequests();
      return null;
    }
    function Querying() {
      useQuery({ query: probe });
      return null;
    }
    // The query mounts in a later render, once the indicator has subscribed.
    const tree = (withQuery: boolean) =>
      createElement(Provider, { value: client }, [
        createElement(Indicator, { key: 'indicator' }),
        withQuery ? createElement(Querying, { key: 'querying' }) : null,
      ]);
    const { rerender, unmount } = render(tree(false));

    await act(async () => {
      rerender(tree(true));
    });
    expect(error.mock.calls.map(args => String(args[0]))).not.toContainEqual(
      expect.stringContaining('Cannot update a component'),
    );
    expect(count).toBe(1);

    await act(async () => {
      release();
    });
    unmount();
    error.mockRestore();
  });
});
