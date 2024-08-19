import * as itty from 'itty-router';
import zod from 'zod';
import { createAnalytics, type Analytics } from './analytics';
import { type ArtifactStorageReader, type ArtifactsType } from './artifact-storage-reader';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse, UnexpectedError } from './errors';
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
  | { type: 'body'; body: string }
  | {
      type: 'redirect';
      location: {
        public: string;
        private: string;
      };
    }
>;

type ArtifactRequestHandler = {
  artifactStorageReader: ArtifactStorageReader;
  isKeyValid: KeyValidator;
  isAppDeploymentActive: IsAppDeploymentActive;
  analytics?: Analytics;
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

    /** Legacy handling for old client SDK versions. */
    if (params.artifactType === 'schema') {
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

    const result = await deps.artifactStorageReader.generateArtifactReadUrl(
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

    if (result.type === 'redirect') {
      if (params.artifactType === 'metadata') {
        // To not change a lot of logic and still reuse the etag bits, we
        // fetch metadata using the redirect location.
        // Once we convert all the legacy metadata (SINGLE project passes an array instead of an object),
        // we can remove this and continue serving a redirect.
        // In case of metadata, we need to fetch the artifact and transform it.
        // We're using here a private location, because the public S3 endpoint may differ from the internal S3 endpoint. E.g. within a docker network,
        // and we're fetching the artifact from within the private network.
        // If they are the same, private and public locations will be the same.
        const metadataResponse = await fetch(result.location.private);

        if (!metadataResponse.ok) {
          console.error(
            'Failed to fetch metadata',
            metadataResponse.status,
            metadataResponse.statusText,
          );

          return new UnexpectedError(analytics, request);
        }

        const body = await metadataResponse.text();

        // Metadata in SINGLE projects is only Mesh's Metadata, and it always defines _schema
        const isMeshArtifact = body.includes(`"#/definitions/_schema"`);
        const hasTopLevelArray = body.startsWith('[') && body.endsWith(']');

        // Mesh's Metadata shared by Mesh is always an object.
        // The top-level array was caused #3291 and fixed now, but we still need to handle the old data.
        if (isMeshArtifact && hasTopLevelArray) {
          const etag = metadataResponse.headers.get('etag');
          return createResponse(
            analytics,
            body.substring(1, body.length - 1),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                ...(etag ? { etag } : {}),
              },
            },
            params.targetId,
            request,
          );
        }
      }

      return createResponse(
        analytics,
        'Found.',
        // We're using here a public location, because we expose the Location to the end user and
        // the public S3 endpoint may differ from the internal S3 endpoint. E.g. within a docker network.
        // If they are the same, private and public locations will be the same.
        { status: 302, headers: { Location: result.location.public } },
        params.targetId,
        request,
      );
    }
  }

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
          // We're using here a public location, because we expose the Location to the end user and
          // the public S3 endpoint may differ from the internal S3 endpoint. E.g. within a docker network.
          // If they are the same, private and public locations will be the same.
          { status: 200 },
          params.targetId,
          request,
        );

        deps.requestCache?.set(request, response);
        return response;
      }
    },
  );

  return async (request: Request, captureException?: (error: unknown) => void) => {
    return router.handle(request, captureException);
  };
};
