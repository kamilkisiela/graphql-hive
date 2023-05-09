import itty from 'itty-router';
import zod from 'zod';
import { createFetch, type Request } from '@whatwg-node/fetch';
import { createAnalytics, type Analytics } from './analytics';
import { type ArtifactsType } from './artifact-storage-reader';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse } from './errors';
import type { KeyValidator } from './key-validation';

const { Response } = createFetch({ useNodeFetch: true });

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
        return new Response('Not found.', { status: 404 });
      }

      const params = parseResult.data;

      /** Legacy handling for old client SDK versions. */
      if (params.artifactType === 'schema') {
        return new Response('Found.', {
          status: 301,
          headers: {
            Location: request.url.replace('/schema', '/services'),
          },
        });
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
          new Response('Something went wrong, really wrong.', { status: 500 })
        );
      }

      if (result.type === 'notModified') {
        return new Response('', {
          status: 304,
        });
      }
      if (result.type === 'notFound') {
        return new Response('Not found.', { status: 404 });
      }
      if (result.type === 'redirect') {
        return new Response('Found.', { status: 302, headers: { Location: result.location } });
      }
    },
  );

  return (request: Request, captureException?: (error: unknown) => void) =>
    router.handle(request, captureException);
};
