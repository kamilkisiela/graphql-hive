import * as itty from 'itty-router';
import zod from 'zod';
import { createAnalytics, type Analytics } from './analytics';
import { type ArtifactStorageReader, type ArtifactsType } from './artifact-storage-reader';
import { createBreadcrumb, type Breadcrumb } from './breadcrumbs';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse } from './errors';
import { IsAppDeploymentActive } from './is-app-deployment-active';
import type { KeyValidator } from './key-validation';
import { createResponse } from './tracked-response';

export type GetArtifactActionFn = (
  targetId: string,
  contractName: string | null,
  artifactType: ArtifactsType,
  eTag: string | null,
) => Promise<
  | { type: 'notModified' }
  | { type: 'notFound' }
  | { type: 'response'; status: Response['status']; headers: Response['headers']; body: string }
>;

type ArtifactRequestHandler = {
  artifactStorageReader: ArtifactStorageReader;
  isKeyValid: KeyValidator;
  isAppDeploymentActive: IsAppDeploymentActive;
  analytics?: Analytics;
  breadcrumb?: Breadcrumb;
  fallback?: (
    request: Request,
    params: { targetId: string; artifactType: string },
  ) => Promise<Response | undefined>;
  requestCache?: {
    get: (request: Request) => Promise<Response | undefined>;
    set: (request: Request, response: Response) => void;
  };
};

const ParamsModel = zod.object({
  targetId: zod.string(),
  artifactType: zod.union([
    zod.literal('metadata'),
    zod.literal('sdl'),
    zod.literal('sdl.graphql'),
    zod.literal('sdl.graphqls'),
    zod.literal('services'),
    zod.literal('schema'),
    zod.literal('supergraph'),
  ]),
  contractName: zod
    .string()
    .optional()
    .transform(value => value ?? null),
});

const VersionedParamsModel = zod.object({
  targetId: zod.string(),
  versionId: zod.string().uuid(),
  artifactType: zod.union([
    zod.literal('metadata'),
    zod.literal('sdl'),
    zod.literal('sdl.graphql'),
    zod.literal('sdl.graphqls'),
    zod.literal('services'),
    zod.literal('supergraph'),
  ]),
  contractName: zod
    .string()
    .optional()
    .transform(value => value ?? null),
});

export const AppDeploymentsManifestParamsModel = zod.object({
  targetId: zod.string(),
  appName: zod.string(),
  appVersion: zod.string(),
});

const PersistedOperationParamsModel = zod.object({
  targetId: zod.string(),
  appName: zod.string(),
  appVersion: zod.string(),
  operationHash: zod.string(),
});

const authHeaderName = 'x-hive-cdn-key' as const;

export const createArtifactRequestHandler = (deps: ArtifactRequestHandler) => {
  const router = itty.Router<itty.IRequest & Request>();
  const analytics = deps.analytics ?? createAnalytics();
  const breadcrumb = deps.breadcrumb ?? createBreadcrumb();

  const authenticate = async (
    request: itty.IRequest & Request,
    targetId: string,
  ): Promise<Response | null> => {
    const headerKey = request.headers.get(authHeaderName);
    if (headerKey === null) {
      return new MissingAuthKeyResponse(analytics, request);
    }

    const isValid = await deps.isKeyValid(targetId, headerKey);

    if (isValid) {
      return null;
    }

    return new InvalidAuthKeyResponse(analytics, request);
  };

  async function handlerV1(request: itty.IRequest & Request) {
    const parseResult = ParamsModel.safeParse(request.params);

    if (parseResult.success === false) {
      analytics.track(
        { type: 'error', value: ['invalid-params'] },
        request.params?.targetId ?? 'unknown',
      );
      return createResponse(
        analytics,
        'Not found.',
        {
          status: 404,
        },
        request.params?.targetId ?? 'unknown',
        request,
      );
    }

    const params = parseResult.data;

    breadcrumb(
      `Artifact v1 handler (type=${params.artifactType}, targetId=${params.targetId}, contractName=${params.contractName})`,
    );

    /** Legacy handling for old client SDK versions. */
    if (params.artifactType === 'schema') {
      breadcrumb('Redirecting from /schema to /services');
      return createResponse(
        analytics,
        'Found.',
        {
          status: 301,
          headers: {
            Location: request.url.replace('/schema', '/services'),
          },
        },
        params.targetId,
        request,
      );
    }

    const maybeResponse = await authenticate(request, params.targetId);

    if (maybeResponse !== null) {
      return maybeResponse;
    }

    analytics.track(
      { type: 'artifact', value: params.artifactType, version: 'v1' },
      params.targetId,
    );

    const eTag = request.headers.get('if-none-match');

    const result = await deps.artifactStorageReader.readArtifact(
      params.targetId,
      params.contractName,
      params.artifactType,
      eTag,
    );

    if (result.type === 'notModified') {
      return createResponse(
        analytics,
        null,
        {
          status: 304,
        },
        params.targetId,
        request,
      );
    }

    if (result.type === 'notFound') {
      return createResponse(analytics, 'Not found.', { status: 404 }, params.targetId, request);
    }

    if (result.type === 'response') {
      const sharedHeaders: Record<string, string> = {};
      const etag = result.headers.get('etag');
      // S3/R2 returns custom metadata with x-amz-meta- prefix
      const graphVersionId =
        result.headers.get('x-amz-meta-x-hive-graph-version-id') ??
        result.headers.get('x-amz-meta-x-hive-schema-version-id');
      const updatedAt = result.headers.get('x-amz-meta-x-hive-updated-at');
      const graphId = result.headers.get('x-amz-meta-x-hive-graph-id');

      if (etag) {
        sharedHeaders['etag'] = etag;
      }

      if (graphVersionId) {
        sharedHeaders['x-hive-schema-version-id'] = graphVersionId;
        sharedHeaders['x-hive-graph-version-id'] = graphVersionId;
      }

      if (graphId) {
        sharedHeaders['x-hive-graph-id'] = graphId;
      }

      if (updatedAt) {
        sharedHeaders['last-modified'] = updatedAt;
      }

      const text = result.body;

      if (params.artifactType === 'metadata') {
        // To not change a lot of logic and still reuse the etag bits, we
        // fetch metadata using the redirect location.
        // Once we convert all the legacy metadata (SINGLE project passes an array instead of an object),
        // we can remove this and continue serving a redirect.
        // In case of metadata, we need to fetch the artifact and transform it.
        // We're using here a private location, because the public S3 endpoint may differ from the internal S3 endpoint. E.g. within a docker network,
        // and we're fetching the artifact from within the private network.
        // If they are the same, private and public locations will be the same.

        // Metadata in SINGLE projects is only Mesh's Metadata, and it always defines _schema
        const isMeshArtifact = text.includes(`"#/definitions/_schema"`);
        const hasTopLevelArray = text.startsWith('[') && text.endsWith(']');

        // Mesh's Metadata shared by Mesh is always an object.
        // The top-level array was caused #3291 and fixed now, but we still need to handle the old data.
        if (isMeshArtifact && hasTopLevelArray) {
          return createResponse(
            analytics,
            text.substring(1, text.length - 1),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...sharedHeaders,
              },
            },
            params.targetId,
            request,
          );
        }
      }

      return createResponse(
        analytics,
        text,
        {
          status: 200,
          headers: {
            'Content-Type':
              params.artifactType === 'metadata' || params.artifactType === 'services'
                ? 'application/json'
                : 'text/plain',
            ...sharedHeaders,
          },
        },
        params.targetId,
        request,
      );
    }

    result satisfies never;
  }

  async function handlerV1Versioned(request: itty.IRequest & Request) {
    const parseResult = VersionedParamsModel.safeParse(request.params);

    if (parseResult.success === false) {
      analytics.track(
        { type: 'error', value: ['invalid-params'] },
        request.params?.targetId ?? 'unknown',
      );
      return createResponse(
        analytics,
        'Not found.',
        {
          status: 404,
        },
        request.params?.targetId ?? 'unknown',
        request,
      );
    }

    const params = parseResult.data;

    breadcrumb(
      `Artifact v1 versioned handler (type=${params.artifactType}, targetId=${params.targetId}, versionId=${params.versionId}, contractName=${params.contractName})`,
    );

    const maybeResponse = await authenticate(request, params.targetId);

    if (maybeResponse !== null) {
      return maybeResponse;
    }

    analytics.track(
      { type: 'artifact', value: params.artifactType, version: 'v1-versioned' },
      params.targetId,
    );

    const eTag = request.headers.get('if-none-match');

    const result = await deps.artifactStorageReader.readArtifact(
      params.targetId,
      params.contractName,
      params.artifactType,
      eTag,
      params.versionId,
    );

    if (result.type === 'notModified') {
      return createResponse(
        analytics,
        null,
        {
          status: 304,
        },
        params.targetId,
        request,
      );
    }

    if (result.type === 'notFound') {
      return createResponse(analytics, 'Not found.', { status: 404 }, params.targetId, request);
    }

    if (result.type === 'response') {
      const etag = result.headers.get('etag');
      // S3/R2 returns custom metadata with x-amz-meta- prefix
      const schemaVersionId = result.headers.get('x-amz-meta-x-hive-schema-version-id');
      const updatedAt = result.headers.get('x-amz-meta-x-hive-updated-at');
      const text = result.body;

      if (params.artifactType === 'metadata') {
        // Legacy handling for SINGLE project metadata (same as handlerV1)
        // Metadata in SINGLE projects is only Mesh's Metadata, and it always defines _schema
        const isMeshArtifact = text.includes(`"#/definitions/_schema"`);
        const hasTopLevelArray = text.startsWith('[') && text.endsWith(']');

        // Mesh's Metadata shared by Mesh is always an object.
        // The top-level array was caused #3291 and fixed now, but we still need to handle the old data.
        if (isMeshArtifact && hasTopLevelArray) {
          return createResponse(
            analytics,
            text.substring(1, text.length - 1),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=31536000, immutable',
                ...(etag ? { etag } : {}),
                ...(schemaVersionId ? { 'x-hive-schema-version-id': schemaVersionId } : {}),
                ...(updatedAt ? { 'Last-Modified': updatedAt } : {}),
              },
            },
            params.targetId,
            request,
          );
        }
      }

      return createResponse(
        analytics,
        text,
        {
          status: 200,
          headers: {
            'Content-Type':
              params.artifactType === 'metadata' || params.artifactType === 'services'
                ? 'application/json'
                : 'text/plain',
            // Versioned artifacts are immutable - aggressive caching
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...(etag ? { etag } : {}),
            ...(schemaVersionId ? { 'x-hive-schema-version-id': schemaVersionId } : {}),
          },
        },
        params.targetId,
        request,
      );
    }

    // Exhaustive check - should never reach here
    result satisfies never;
  }

  // Versioned artifact routes (must be before non-versioned routes)
  router.get(
    '/artifacts/v1/:targetId/version/:versionId/contracts/:contractName/:artifactType',
    handlerV1Versioned,
  );
  router.get('/artifacts/v1/:targetId/version/:versionId/:artifactType', handlerV1Versioned);

  // Non-versioned artifact routes (latest)
  router.get('/artifacts/v1/:targetId/contracts/:contractName/:artifactType', handlerV1);
  router.get('/artifacts/v1/:targetId/:artifactType', handlerV1);
  router.get(
    '/artifacts/v1/:targetId/apps/:appName/:appVersion/:operationHash',
    async function PersistedOperationHandler(request) {
      const parseResult = PersistedOperationParamsModel.safeParse(request.params);

      if (parseResult.success === false) {
        analytics.track(
          { type: 'error', value: ['invalid-params'] },
          request.params?.targetId ?? 'unknown',
        );

        return createResponse(
          analytics,
          'Not found.',
          {
            status: 404,
          },
          request.params?.targetId ?? 'unknown',
          request,
        );
      }

      const params = parseResult.data;

      const maybeResponse = await authenticate(request, params.targetId);

      if (maybeResponse !== null) {
        return maybeResponse;
      }

      const response = await deps.requestCache?.get(request);
      if (response) {
        return response;
      }

      if (
        false ===
        (await deps.isAppDeploymentActive(params.targetId, params.appName, params.appVersion))
      ) {
        analytics.track(
          { type: 'error', value: ['app-deployment-not-active'] },
          request.params?.targetId ?? 'unknown',
        );

        return createResponse(
          analytics,
          'Not found.',
          {
            status: 404,
          },
          params.targetId,
          request,
        );
      }

      analytics.track({ type: 'app-deployment-operation', version: 'v1' }, params.targetId);

      const eTag = request.headers.get('if-none-match');

      const result = await deps.artifactStorageReader.loadAppDeploymentPersistedOperation(
        params.targetId,
        params.appName,
        params.appVersion,
        params.operationHash,
        eTag,
      );

      if (result.type === 'notModified') {
        const response = createResponse(
          analytics,
          null,
          {
            status: 304,
          },
          params.targetId,
          request,
        );

        deps.requestCache?.set(request, response);
        return response;
      }

      if (result.type === 'notFound') {
        return createResponse(analytics, 'Not found.', { status: 404 }, params.targetId, request);
      }

      if (result.type === 'body') {
        const response = createResponse(
          analytics,
          result.body,
          { status: 200 },
          params.targetId,
          request,
        );

        deps.requestCache?.set(request, response);
        return response;
      }
    },
  );
  router.get(
    '/artifacts/v1/:targetId/apps/:appName/:appVersion',
    async function AppDeploymentManifestHandler(request) {
      const parseResult = AppDeploymentsManifestParamsModel.safeParse(request.params);

      if (parseResult.success === false) {
        analytics.track(
          { type: 'error', value: ['invalid-params'] },
          request.params?.targetId ?? 'unknown',
        );

        return createResponse(
          analytics,
          'Not found.',
          {
            status: 404,
          },
          request.params?.targetId ?? 'unknown',
          request,
        );
      }

      const params = parseResult.data;

      const maybeResponse = await authenticate(request, params.targetId);

      if (maybeResponse !== null) {
        return maybeResponse;
      }

      const manifest = await deps.artifactStorageReader.readAppDeploymentManifest(
        params.targetId,
        params.appName,
        params.appVersion,
      );

      if (manifest === null) {
        return createResponse(
          analytics,
          'Not found.',
          {
            status: 404,
          },
          request.params?.targetId ?? 'unknown',
          request,
        );
      }

      const response = createResponse(
        analytics,
        JSON.stringify(manifest),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
        params.targetId,
        request,
      );

      return response;
    },
  );

  return async (request: Request, captureException?: (error: unknown) => void) => {
    return router.handle(request, captureException);
  };
};
