// @vitest-environment happy-dom
import { buildSchema, introspectionFromSchema } from 'graphql';
import { act, renderHook } from '@testing-library/react';
import { useEndpoint } from './endpoint';
import { defaultLaboratorySettings } from './settings';

const load = vi.fn();

vi.mock('@graphql-tools/url-loader', () => ({
  UrlLoader: class {
    load(...args: unknown[]) {
      return load(...args);
    }
  },
  SubscriptionProtocol: { GRAPHQL_SSE: 'GRAPHQL_SSE' },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const ENDPOINT = 'http://localhost:4000/graphql';
const SDL = 'type Query { me: String }';

const settingsApiWithHeaders = (headers: string) =>
  ({
    settings: {
      ...defaultLaboratorySettings,
      introspection: { ...defaultLaboratorySettings.introspection, headers },
    },
  }) as unknown as Parameters<typeof useEndpoint>[0]['settingsApi'];

/** The debounce is 500ms and the schema poll interval is 5s. */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useEndpoint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    load.mockReset();
    load.mockResolvedValue([{ schema: buildSchema(SDL) }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the same GraphQLSchema reference when a poll returns an unchanged schema', async () => {
    const { result } = renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT }));

    await advance(600);
    const schema = result.current.schema;
    expect(schema).not.toBeNull();

    await advance(6000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.schema).toBe(schema);
  });

  it('produces a new GraphQLSchema reference when the schema changes', async () => {
    const { result } = renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT }));

    await advance(600);
    const schema = result.current.schema;

    load.mockResolvedValue([{ schema: buildSchema('type Query { me: String, id: ID! }') }]);

    await advance(6000);
    expect(result.current.schema).not.toBe(schema);
    expect(result.current.schema?.getQueryType()?.getFields().id).toBeDefined();
  });

  describe('reloadSchema', () => {
    const DEFAULT_INTROSPECTION = introspectionFromSchema(
      buildSchema('type Query { fromRegistry: String }'),
    );

    it('introspects over the network even when a default introspection is supplied', async () => {
      const { result } = renderHook(() =>
        useEndpoint({
          defaultEndpoint: ENDPOINT,
          defaultSchemaIntrospection: DEFAULT_INTROSPECTION,
        }),
      );

      await advance(600);
      expect(load).not.toHaveBeenCalled();
      expect(result.current.schema?.getQueryType()?.getFields().fromRegistry).toBeDefined();

      act(() => {
        result.current.reloadSchema();
      });
      await advance(600);

      expect(load).toHaveBeenCalledTimes(1);
      expect(result.current.schema?.getQueryType()?.getFields().me).toBeDefined();
    });

    it('does not let a later fetch put the supplied introspection back', async () => {
      const { result, rerender } = renderHook(
        (headers: string) =>
          useEndpoint({
            defaultEndpoint: ENDPOINT,
            defaultSchemaIntrospection: DEFAULT_INTROSPECTION,
            settingsApi: settingsApiWithHeaders(headers),
          }),
        { initialProps: '' },
      );

      await advance(600);
      act(() => {
        result.current.reloadSchema();
      });
      await advance(600);
      expect(result.current.schema?.getQueryType()?.getFields().me).toBeDefined();

      // Changing an introspection setting rebuilds fetchSchema, which re-runs the
      // fetch effect without `force`.
      rerender('{"authorization":"token"}');
      await advance(600);

      expect(result.current.schema?.getQueryType()?.getFields().me).toBeDefined();
      expect(result.current.schema?.getQueryType()?.getFields().fromRegistry).toBeUndefined();
    });

    it('reports in-flight state from the click, not from the debounced fetch', async () => {
      const { result } = renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT }));

      await advance(600);

      act(() => {
        result.current.reloadSchema();
      });
      expect(result.current.isFetchingSchema).toBe(true);

      await advance(600);
      expect(result.current.isFetchingSchema).toBe(false);
    });
  });

  describe('preflight', () => {
    it('keeps env and plugin state when preflight is disabled', async () => {
      type Props = Parameters<typeof useEndpoint>[0];
      const setEnv = vi.fn();
      const setPluginsState = vi.fn();

      renderHook(() =>
        useEndpoint({
          defaultEndpoint: ENDPOINT,
          settingsApi: settingsApiWithHeaders(
            '{"authorization":"Bearer {{token}}","x-slug":"{{plugins.target.slug}}"}',
          ),
          envApi: { env: { variables: { token: 'secret' } }, setEnv } as Props['envApi'],
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

      await advance(600);

      expect(setEnv).not.toHaveBeenCalled();
      expect(setPluginsState).not.toHaveBeenCalled();
      expect(load).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({ headers: { authorization: 'Bearer secret', 'x-slug': 'x' } }),
      );
    });

    it('lets preflight headers win and sends them verbatim', async () => {
      type Props = Parameters<typeof useEndpoint>[0];
      const setEnv = vi.fn();

      renderHook(() =>
        useEndpoint({
          defaultEndpoint: ENDPOINT,
          settingsApi: settingsApiWithHeaders('{"Authorization":"Bearer {{token}}","x-op":"mine"}'),
          envApi: { env: { variables: { token: 'secret' } }, setEnv } as Props['envApi'],
          preflightApi: {
            runPreflight: vi.fn().mockResolvedValue({
              status: 'success',
              env: { variables: { token: 'secret' } },
              headers: { authorization: 'from-preflight {{token}}' },
              pluginsState: {},
              logs: [],
            }),
          } as unknown as Props['preflightApi'],
        }),
      );

      await advance(600);

      expect(setEnv).toHaveBeenCalledWith({ variables: { token: 'secret' } });
      expect(load).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          headers: { 'x-op': 'mine', authorization: 'from-preflight {{token}}' },
        }),
      );
    });
  });

  describe('descriptions', () => {
    it('requests them when the docs pane is enabled', async () => {
      renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT, enableDocs: true }));

      await advance(600);

      expect(load).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ descriptions: true }));
    });

    it('leaves them out of the payload when the docs pane is disabled', async () => {
      renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT }));

      await advance(600);

      expect(load).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ descriptions: false }));
    });
  });

  describe('schema polling', () => {
    const settingsApiWithPolling = (pollSchema: boolean) =>
      ({
        settings: {
          ...defaultLaboratorySettings,
          introspection: { ...defaultLaboratorySettings.introspection, pollSchema },
        },
      }) as unknown as Parameters<typeof useEndpoint>[0]['settingsApi'];

    it('keeps re-introspecting while polling is on', async () => {
      renderHook(() =>
        useEndpoint({ defaultEndpoint: ENDPOINT, settingsApi: settingsApiWithPolling(true) }),
      );

      await advance(600);
      expect(load).toHaveBeenCalledTimes(1);

      await advance(6000);
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('introspects once and then stops when polling is off', async () => {
      const { result } = renderHook(() =>
        useEndpoint({ defaultEndpoint: ENDPOINT, settingsApi: settingsApiWithPolling(false) }),
      );

      await advance(600);
      expect(load).toHaveBeenCalledTimes(1);
      expect(result.current.schema).not.toBeNull();

      await advance(20_000);
      expect(load).toHaveBeenCalledTimes(1);
    });

    it('still reports that introspection is possible so its settings stay reachable', async () => {
      const { result } = renderHook(() =>
        useEndpoint({ defaultEndpoint: ENDPOINT, settingsApi: settingsApiWithPolling(false) }),
      );

      await advance(600);

      expect(result.current.shouldPollSchema).toBe(false);
      expect(result.current.canIntrospect).toBe(true);
    });
  });

  it('clears the schema when fetching without an endpoint', async () => {
    const { result } = renderHook(() => useEndpoint({ defaultEndpoint: ENDPOINT }));

    await advance(600);
    expect(result.current.schema).not.toBeNull();

    // Note: no effect fetches on an empty endpoint, so this drives fetchSchema directly.
    act(() => {
      result.current.setEndpoint('');
    });
    act(() => {
      void result.current.fetchSchema();
    });
    await advance(600);

    expect(result.current.schema).toBeNull();
  });
});
