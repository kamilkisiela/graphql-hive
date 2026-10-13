import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildClientSchema,
  GraphQLSchema,
  introspectionFromSchema,
  type IntrospectionQuery,
} from 'graphql';
import { debounce, type DebouncedFunc } from 'lodash';
import { toast } from 'sonner';
import { LaboratoryEnv, LaboratoryEnvActions, LaboratoryEnvState } from '@/lib/env';
import { LaboratoryOperationsActions, LaboratoryOperationsState } from '@/lib/operations';
import { handleTemplate, mergeHeaders } from '@/lib/operations.utils';
import { LaboratoryPluginsActions, LaboratoryPluginsState } from '@/lib/plugins';
import { LaboratoryPreflightActions, LaboratoryPreflightState } from '@/lib/preflight';
import { asyncInterval } from '@/lib/utils';
import { SubscriptionProtocol, UrlLoader } from '@graphql-tools/url-loader';
import type { LaboratorySettingsActions, LaboratorySettingsState } from './settings';

export interface LaboratoryEndpointState {
  endpoint: string | null;
  schema: GraphQLSchema | null;
  introspection: IntrospectionQuery | null;
  defaultEndpoint: string | null;
  canIntrospect: boolean;
  shouldPollSchema: boolean;
  isFetchingSchema: boolean;
}

export type FetchSchemaOptions = {
  env?: LaboratoryEnv;
  pluginsState?: Record<string, any>;
  /** Introspect over the network even when a default introspection is available. */
  force?: boolean;
};

export type FetchSchema = DebouncedFunc<
  (signal?: AbortSignal, options?: FetchSchemaOptions) => Promise<void>
>;

export interface LaboratoryEndpointActions {
  setEndpoint: (endpoint: string) => void;
  fetchSchema: FetchSchema;
  reloadSchema: () => void;
  restoreDefaultEndpoint: () => void;
}

export const EXPECTED_ERROR_REASON = 'Expected error reason';

export const useEndpoint = (props: {
  defaultEndpoint?: string | null;
  onEndpointChange?: (endpoint: string | null) => void;
  defaultSchemaIntrospection?: IntrospectionQuery | null;
  enableDocs?: boolean;
  settingsApi?: LaboratorySettingsState & LaboratorySettingsActions;
  operationsApi?: LaboratoryOperationsState & LaboratoryOperationsActions;
  envApi?: LaboratoryEnvState & LaboratoryEnvActions;
  pluginsApi?: LaboratoryPluginsState & LaboratoryPluginsActions;
  preflightApi?: LaboratoryPreflightState & LaboratoryPreflightActions;
}): LaboratoryEndpointState & LaboratoryEndpointActions => {
  const [endpoint, _setEndpoint] = useState<string | null>(props.defaultEndpoint ?? null);
  const [introspection, setIntrospection] = useState<IntrospectionQuery | null>(null);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const introspectionSignatureRef = useRef<string | null>(null);
  const hasManuallyReloadedRef = useRef(false);

  const applyIntrospection = useCallback((next: IntrospectionQuery | null) => {
    const signature = next ? JSON.stringify(next) : null;

    // A poll returning an unchanged schema must not produce a new GraphQLSchema
    // reference: the builder resets its expanded paths whenever it sees one.
    if (signature === introspectionSignatureRef.current) {
      return;
    }

    introspectionSignatureRef.current = signature;
    setIntrospection(next);
  }, []);

  const setEndpoint = useCallback(
    (endpoint: string) => {
      _setEndpoint(endpoint);
      props.onEndpointChange?.(endpoint);
    },
    [props],
  );

  const schema = useMemo(() => {
    return introspection ? buildClientSchema(introspection) : null;
  }, [introspection]);

  const loader = useMemo(() => new UrlLoader(), []);

  const activeOperationHeadersRef = useRef<string | null | undefined>(
    props.operationsApi?.activeOperation?.headers,
  );
  const envVariablesRef = useRef<LaboratoryEnv['variables'] | undefined>(
    props.envApi?.env?.variables,
  );
  const pluginsStateRef = useRef<Record<string, any> | undefined>(props.pluginsApi?.pluginsState);

  activeOperationHeadersRef.current = props.operationsApi?.activeOperation?.headers;
  envVariablesRef.current = props.envApi?.env?.variables;
  pluginsStateRef.current = props.pluginsApi?.pluginsState;

  const fetchSchema = useMemo(
    () =>
      debounce(async (signal?: AbortSignal, options?: FetchSchemaOptions) => {
        setIsFetchingSchema(true);

        try {
          // Once the user has reloaded by hand, later effect-driven fetches must
          // not quietly put the supplied introspection back.
          const canUseDefaultIntrospection =
            endpoint === props.defaultEndpoint &&
            props.defaultSchemaIntrospection &&
            !options?.force &&
            !hasManuallyReloadedRef.current;

          if (canUseDefaultIntrospection) {
            applyIntrospection(props.defaultSchemaIntrospection ?? null);
            return;
          }

          if (!endpoint) {
            applyIntrospection(null);
            return;
          }

          let env = options?.env?.variables ?? envVariablesRef.current ?? {};
          let plugins = options?.pluginsState ?? pluginsStateRef.current ?? {};

          let sourceHeaders: Record<string, string> = {};

          if (props.settingsApi?.settings.introspection.headers) {
            try {
              sourceHeaders = JSON.parse(props.settingsApi?.settings.introspection.headers);
            } catch {}
          }

          if (
            props.settingsApi?.settings.introspection.includeActiveOperationHeaders &&
            activeOperationHeadersRef.current
          ) {
            try {
              sourceHeaders = {
                ...sourceHeaders,
                ...JSON.parse(activeOperationHeadersRef.current),
              };
            } catch {}
          }

          const stringifiedHeaders = JSON.stringify(sourceHeaders);
          let preflightHeaders: Record<string, string> = {};

          if (stringifiedHeaders.includes('{{')) {
            try {
              const preflightResult = await props.preflightApi?.runPreflight?.(
                props.pluginsApi?.plugins ?? [],
                props.pluginsApi?.pluginsState ?? {},
              );

              // Null means preflight is disabled; the stored env and plugin state stay in use.
              if (preflightResult) {
                props.envApi?.setEnv(preflightResult.env);
                props.pluginsApi?.setPluginsState(preflightResult.pluginsState);

                env = preflightResult.env.variables;
                plugins = preflightResult.pluginsState;
                preflightHeaders = preflightResult.headers;
              }
            } catch (error: unknown) {
              toast.error('Failed to run preflight');
            }
          }

          let parsedHeaders: Record<string, string> = {};

          try {
            parsedHeaders = JSON.parse(
              handleTemplate(stringifiedHeaders, {
                ...env,
                plugins,
              }),
            );
          } catch (error: unknown) {
            toast.error('Failed to parse headers');
            parsedHeaders = {};
          }

          // Preflight values are sent verbatim, so they merge after templating.
          parsedHeaders = mergeHeaders(parsedHeaders, preflightHeaders);

          const result = await loader.load(endpoint, {
            subscriptionsEndpoint: endpoint,
            subscriptionsProtocol:
              (props.settingsApi?.settings.subscriptions.protocol as SubscriptionProtocol) ??
              SubscriptionProtocol.GRAPHQL_SSE,
            headers: parsedHeaders,
            credentials: props.settingsApi?.settings.fetch.credentials,
            specifiedByUrl: true,
            directiveIsRepeatable: true,
            inputValueDeprecation: true,
            timeout: props.settingsApi?.settings.fetch.timeout,
            useGETForQueries: props.settingsApi?.settings.fetch.useGETForQueries,
            exposeHTTPDetailsInExtensions: true,
            // Only worth the payload when the docs pane can render them.
            descriptions: props.enableDocs === true,
            method: props.settingsApi?.settings.introspection.method ?? 'POST',
            fetch: (input: string | URL | Request, init?: RequestInit) =>
              fetch(input, {
                ...init,
                signal,
              }),
          });

          if (result.length === 0) {
            throw new Error('Failed to fetch schema');
          }

          if (!result[0].schema) {
            throw new Error('Failed to fetch schema');
          }

          applyIntrospection(introspectionFromSchema(result[0].schema));
        } catch (error: unknown) {
          if (
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
          ) {
            if (error.message === EXPECTED_ERROR_REASON) {
              return;
            }

            toast.error(error.message);
          } else {
            toast.error('Failed to fetch schema');
          }

          applyIntrospection(null);

          throw error;
        } finally {
          setIsFetchingSchema(false);
        }
      }, 500),
    [
      applyIntrospection,
      endpoint,
      props.defaultEndpoint,
      props.defaultSchemaIntrospection,
      props.enableDocs,
      props.settingsApi?.settings.fetch.timeout,
      props.settingsApi?.settings.introspection.method,
      props.settingsApi?.settings.introspection.headers,
      props.settingsApi?.settings.introspection.includeActiveOperationHeaders,
    ],
  );

  useEffect(() => {
    return () => {
      // A cancelled call never reaches its finally, so clear the flag here too.
      fetchSchema.cancel();
      setIsFetchingSchema(false);
    };
  }, [fetchSchema]);

  useEffect(() => {
    hasManuallyReloadedRef.current = false;
  }, [endpoint, props.defaultSchemaIntrospection]);

  const reloadSchema = useCallback(() => {
    hasManuallyReloadedRef.current = true;
    // Set before the 500ms debounce so the button reacts to the click, not the fetch.
    setIsFetchingSchema(true);

    void fetchSchema(undefined, { force: true });
  }, [fetchSchema]);

  // Whether introspection reaches the network at all: with the default endpoint and
  // a supplied introspection there is nothing to fetch.
  const canIntrospect = useMemo(() => {
    return endpoint !== props.defaultEndpoint || !props.defaultSchemaIntrospection;
  }, [endpoint, props.defaultEndpoint, props.defaultSchemaIntrospection]);

  const shouldPollSchema = useMemo(() => {
    return canIntrospect && props.settingsApi?.settings.introspection.pollSchema !== false;
  }, [canIntrospect, props.settingsApi?.settings.introspection.pollSchema]);

  useEffect(() => {
    if (!shouldPollSchema || !endpoint) {
      return;
    }

    const intervalController = new AbortController();

    void asyncInterval(
      async () => {
        try {
          await fetchSchema(intervalController.signal);
        } catch {
          intervalController.abort(new Error('Aborted because of schema polling error'));
        }
      },
      5000,
      intervalController.signal,
    );

    return () => {
      intervalController.abort(new Error(EXPECTED_ERROR_REASON));
    };
  }, [shouldPollSchema, fetchSchema]);

  const restoreDefaultEndpoint = useCallback(() => {
    if (props.defaultEndpoint) {
      setEndpoint(props.defaultEndpoint);
    }
  }, [props.defaultEndpoint]);

  useEffect(() => {
    if (endpoint && !shouldPollSchema) {
      const abortController = new AbortController();

      void fetchSchema(abortController.signal);

      return () => {
        abortController.abort(new Error(EXPECTED_ERROR_REASON));
      };
    }
  }, [endpoint, fetchSchema, shouldPollSchema]);

  useEffect(() => {
    if (!endpoint || !shouldPollSchema) {
      return;
    }

    const abortController = new AbortController();
    void fetchSchema(abortController.signal, {
      env: props.envApi?.env ?? undefined,
      pluginsState: props.pluginsApi?.pluginsState,
    });

    return () => {
      abortController.abort(new Error(EXPECTED_ERROR_REASON));
    };
  }, [
    endpoint,
    shouldPollSchema,
    fetchSchema,
    props.settingsApi?.settings.introspection.headers,
    props.settingsApi?.settings.introspection.includeActiveOperationHeaders,
  ]);

  return {
    endpoint,
    setEndpoint,
    schema,
    introspection,
    fetchSchema,
    reloadSchema,
    restoreDefaultEndpoint,
    defaultEndpoint: props.defaultEndpoint ?? null,
    canIntrospect,
    shouldPollSchema,
    isFetchingSchema,
  };
};
