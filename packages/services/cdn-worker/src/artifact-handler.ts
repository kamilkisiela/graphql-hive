import itty from 'itty-router';
import zod from 'zod';
import { type Request } from '@whatwg-node/fetch';
import { createAnalytics, type Analytics } from './analytics';
import { type ArtifactsType } from './artifact-storage-reader';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse } from './errors';
import type { KeyValidator } from './key-validation';
import { createResponse } from './tracked-response';

type ArtifactRequestHandler = {
  getArtifactAction: (
    targetId: string,
    artifactType: ArtifactsType,
    eTag: string | null,
  ) => Promise<
    { type: 'notModified' } | { type: 'notFound' } | { type: 'redirect'; location: string }
  >;
  isKeyValid: KeyValidator;
  analytics?: Analytics;
  fallback?: (
    request: Request,
    params: { targetId: string; artifactType: string },
  ) => Promise<Response | undefined>;
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
});

const authHeaderName = 'x-hive-cdn-key' as const;

export const createArtifactRequestHandler = (deps: ArtifactRequestHandler) => {
  const router = itty.Router<itty.Request & Request>();
  const analytics = deps.analytics ?? createAnalytics();

  const authenticate = async (
    request: itty.Request & Request,
    targetId: string,
  ): Promise<Response | null> => {
    const headerKey = request.headers.get(authHeaderName);
    if (headerKey === null) {
      return new MissingAuthKeyResponse(analytics);
    }

    const isValid = await deps.isKeyValid(targetId, headerKey);

    if (isValid) {
      return null;
    }

    return new InvalidAuthKeyResponse(analytics);
  };

  router.get(
    '/artifacts/v1/:targetId/:artifactType',
    async (request: itty.Request & Request, captureException?: (error: unknown) => void) => {
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

      const result = await deps
        .getArtifactAction(params.targetId, params.artifactType, eTag)
        .catch(error => {
          if (deps.fallback) {
            if (captureException) {
              captureException(error);
            } else {
              console.error(error);
            }
            return null;
          }

          return Promise.reject(error);
        });

      if (!result) {
        return (
          deps.fallback?.(request, params) ??
          createResponse(
            analytics,
            'Something went wrong, really wrong.',
            { status: 500 },
            params.targetId,
          )
        );
      }

      if (result.type === 'notModified') {
        return createResponse(
          analytics,
          '',
          {
            status: 304,
          },
          params.targetId,
        );
      }
      if (result.type === 'notFound') {
        return createResponse(analytics, 'Not found.', { status: 404 }, params.targetId);
      }
      if (result.type === 'redirect') {
        return createResponse(
          analytics,
          'Found.',
          { status: 302, headers: { Location: result.location } },
          params.targetId,
        );
      }
    },
  );

  return (request: Request, captureException?: (error: unknown) => void) =>
    router.handle(request, captureException);
};
