// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { LaboratoryCollectionsActions, LaboratoryCollectionsState } from './collections';
import { useOperations, type LaboratoryOperation } from './operations';
import type { LaboratoryTabsActions, LaboratoryTabsState } from './tabs';

const executor = vi.fn();

vi.mock('@graphql-tools/url-loader', () => ({
  UrlLoader: class {
    getExecutorAsync() {
      return executor;
    }
  },
  SubscriptionProtocol: { GRAPHQL_SSE: 'GRAPHQL_SSE' },
}));

const op = (id: string): LaboratoryOperation => ({
  id,
  name: '',
  query: 'query Foo { a }',
  variables: '',
  headers: '',
  extensions: '',
});

// Minimal tabsApi whose active tab points at the given operation id.
const tabsApiFor = (operationId: string) =>
  ({
    activeTab: { id: 't1', type: 'operation', data: { id: operationId, name: '' } },
    tabs: [{ id: 't1', type: 'operation', data: { id: operationId, name: '' } }],
    setActiveTab: vi.fn(),
    setTabs: vi.fn(),
    addTab: vi.fn(),
    updateTab: vi.fn(),
    deleteTab: vi.fn(),
  }) as unknown as LaboratoryTabsState & LaboratoryTabsActions;

// Minimal collectionsApi where the operation lives inside collection "c1".
const collectionsApiWith = (operationId: string) => {
  const updateOperationInCollection = vi.fn();
  const api = {
    collections: [
      {
        id: 'c1',
        name: 'C',
        createdAt: '2026-01-01T00:00:00.000Z',
        operations: [
          { ...op(operationId), description: '', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    ],
    addCollection: vi.fn(),
    addOperationToCollection: vi.fn(),
    deleteCollection: vi.fn(),
    deleteOperationFromCollection: vi.fn(),
    updateCollection: vi.fn(),
    updateOperationInCollection,
  } as unknown as LaboratoryCollectionsState & LaboratoryCollectionsActions;

  return { api, updateOperationInCollection };
};

describe('useOperations', () => {
  it('addOperation fires onOperationsChange and onOperationCreate', () => {
    const onOperationsChange = vi.fn();
    const onOperationCreate = vi.fn();
    const { result } = renderHook(() =>
      useOperations({ checkPermissions: () => true, onOperationsChange, onOperationCreate }),
    );

    let created: LaboratoryOperation;
    act(() => {
      created = result.current.addOperation({
        name: '',
        query: '',
        variables: '',
        headers: '',
        extensions: '',
      });
    });

    expect(created!.id).toBeTruthy();
    expect(onOperationsChange).toHaveBeenCalledWith([created!]);
    expect(onOperationCreate).toHaveBeenCalledWith(created!);
  });

  it('deleteOperation fires onOperationDelete and onOperationsChange', () => {
    const onOperationDelete = vi.fn();
    const onOperationsChange = vi.fn();
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [op('op1')],
        onOperationDelete,
        onOperationsChange,
      }),
    );

    act(() => {
      result.current.deleteOperation('op1');
    });

    expect(result.current.operations).toHaveLength(0);
    expect(onOperationDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'op1' }));
    expect(onOperationsChange).toHaveBeenCalledWith([]);
  });

  it('updateActiveOperation fires onOperationsChange and onOperationUpdate', () => {
    const onOperationUpdate = vi.fn();
    const onOperationsChange = vi.fn();
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [op('op1')],
        tabsApi: tabsApiFor('op1'),
        onOperationUpdate,
        onOperationsChange,
      }),
    );

    act(() => {
      result.current.updateActiveOperation({ query: 'query Bar { a }' });
    });

    expect(onOperationsChange).toHaveBeenCalled();
    expect(onOperationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'op1', query: 'query Bar { a }' }),
    );
  });

  it('writes an edit through to the collection when collectionsOperations:update is permitted', () => {
    const { api, updateOperationInCollection } = collectionsApiWith('op1');
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [op('op1')],
        tabsApi: tabsApiFor('op1'),
        collectionsApi: api,
      }),
    );

    act(() => {
      result.current.updateActiveOperation({ query: 'query Bar { a }' });
    });

    expect(updateOperationInCollection).toHaveBeenCalledTimes(1);
    expect(updateOperationInCollection).toHaveBeenCalledWith(
      'c1',
      'op1',
      expect.objectContaining({ query: 'query Bar { a }' }),
    );
  });

  it('does NOT write through to the collection when the permission is denied', () => {
    const { api, updateOperationInCollection } = collectionsApiWith('op1');
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => false,
        defaultOperations: [op('op1')],
        tabsApi: tabsApiFor('op1'),
        collectionsApi: api,
      }),
    );

    act(() => {
      result.current.updateActiveOperation({ query: 'query Bar { a }' });
    });

    expect(updateOperationInCollection).not.toHaveBeenCalled();
  });
});

describe('runActiveOperation', () => {
  // Mirrors @graphql-tools/executor-legacy-ws: an endless stream whose executor
  // never looks at request.signal, so only our own wrapper can end it.
  const endlessStream = () => {
    let returned = false;

    return {
      wasReturned: () => returned,
      stream: {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return { done: false as const, value: { data: { tick: true } } };
          },
          return: async () => {
            returned = true;
            return { done: true as const, value: undefined };
          },
        }),
      },
    };
  };

  it('stops a subscription whose executor ignores the abort signal', async () => {
    const source = endlessStream();
    executor.mockResolvedValue(source.stream);

    const onResponse = vi.fn();
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [op('op1')],
        tabsApi: tabsApiFor('op1'),
      }),
    );

    let run: Promise<unknown>;
    act(() => {
      run = result.current.runActiveOperation('http://localhost:4000/graphql', { onResponse });
    });

    await waitFor(() => expect(onResponse).toHaveBeenCalled());
    await waitFor(() => expect(result.current.stopActiveOperation).toBeTruthy());

    act(() => result.current.stopActiveOperation!());

    await expect(run!).resolves.toBeNull();
    expect(source.wasReturned()).toBe(true);
    await waitFor(() => expect(result.current.stopActiveOperation).toBeFalsy());
  });

  it('keeps env and plugin state when preflight is disabled', async () => {
    type Props = Parameters<typeof useOperations>[0];
    executor.mockResolvedValue({ data: {} });
    const setPluginsState = vi.fn();

    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [
          {
            ...op('op1'),
            headers: '{"authorization":"Bearer {{token}}","x-slug":"{{plugins.target.slug}}"}',
          },
        ],
        tabsApi: tabsApiFor('op1'),
        envApi: { env: { variables: { token: 'secret' } }, setEnv: vi.fn() } as Props['envApi'],
        pluginsApi: {
          plugins: [],
          pluginsState: { target: { slug: 'x' } },
          setPluginsState,
        } as unknown as Props['pluginsApi'],
        preflightApi: {
          runPreflight: vi.fn().mockResolvedValue(null),
        } as unknown as Props['preflightApi'],
      }),
    );

    await act(async () => {
      await result.current.runActiveOperation('http://localhost:4000/graphql');
    });

    expect(setPluginsState).not.toHaveBeenCalled();
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: expect.objectContaining({
          headers: { authorization: 'Bearer secret', 'x-slug': 'x' },
        }),
      }),
    );
  });

  it('lets preflight headers win over operation headers', async () => {
    type Props = Parameters<typeof useOperations>[0];
    executor.mockResolvedValue({ data: {} });

    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [
          { ...op('op1'), headers: '{"Authorization":"from-operation","x-op":"mine"}' },
        ],
        tabsApi: tabsApiFor('op1'),
        preflightApi: {
          runPreflight: vi.fn().mockResolvedValue({
            status: 'success',
            env: { variables: {} },
            headers: { authorization: 'from-preflight' },
            pluginsState: {},
            logs: [],
          }),
        } as unknown as Props['preflightApi'],
      }),
    );

    await act(async () => {
      await result.current.runActiveOperation('http://localhost:4000/graphql');
    });

    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: expect.objectContaining({
          headers: { 'x-op': 'mine', authorization: 'from-preflight' },
        }),
      }),
    );
  });
});

describe('replaceOperationId', () => {
  it('renames an operation in place and fires onOperationsChange', () => {
    const onOperationsChange = vi.fn();
    const { result } = renderHook(() =>
      useOperations({
        checkPermissions: () => true,
        defaultOperations: [op('local-1'), op('other')],
        onOperationsChange,
      }),
    );

    act(() => {
      result.current.replaceOperationId('local-1', 'server-1');
    });

    expect(result.current.operations.map(o => o.id)).toEqual(['server-1', 'other']);
    expect(onOperationsChange).toHaveBeenCalledWith(result.current.operations);
  });
});

describe('replaceOperationId after later changes', () => {
  it('keeps operations added after the callback was captured', () => {
    const { result } = renderHook(() =>
      useOperations({ checkPermissions: () => true, defaultOperations: [op('local-1')] }),
    );
    const staleReplace = result.current.replaceOperationId;

    act(() => {
      result.current.addOperation({ ...op('later'), id: 'later' });
    });
    act(() => {
      staleReplace('local-1', 'server-1');
    });

    expect(result.current.operations.map(o => o.id)).toEqual(['server-1', 'later']);
  });
});
