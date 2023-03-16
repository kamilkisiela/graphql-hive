import { createRouter, Response, RouterRequest, useErrorHandling } from 'fets';
import zod from 'zod';
import { type Analytics, createAnalytics } from './analytics';
import { type ArtifactsType } from './artifact-storage-reader';
import {
  createInvalidAuthKeyResponse,
  createMissingAuthKeyResponse,
  createUnexpectedErrorResponse,
} from './errors';
import type { KeyValidator } from './key-validation';

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
    request: Request | RouterRequest<any, any, any>,
    params: zod.infer<typeof ParamsModel>,
  ) => Promise<Response>;
};

const ParamsModel = zod.object({
  targetId: zod.string({
    required_error: 'Missing Hive target ID in request params.',
  }),
  artifactType: zod.union(
    [
      zod.literal('metadata'),
      zod.literal('sdl'),
      zod.literal('sdl.graphql'),
      zod.literal('sdl.graphqls'),
      zod.literal('services'),
      zod.literal('schema'),
      zod.literal('supergraph'),
    ],
    {
      invalid_type_error: 'Invalid artifact type',
    },
  ),
});

const authHeaderName = 'x-hive-cdn-key' as const;

function isCaptureException(
  captureException: unknown,
): captureException is (error: unknown) => void {
  return typeof captureException === 'function';
}

export const createArtifactRequestHandler = (deps: ArtifactRequestHandler) => {
  const analytics = deps.analytics ?? createAnalytics();
  return createRouter({
    title: 'Hive CDN Worker',
    description: "Hive CDN's Worker Implementation",
    plugins: [
      useErrorHandling((error, _request, captureException) => {
        console.error(error);
        if (isCaptureException(captureException)) {
          captureException(error);
        }
        return createUnexpectedErrorResponse(analytics);
      }),
    ],
  }).route({
    method: 'GET',
    path: '/artifacts/v1/:targetId/:artifactType',
    schemas: {
      request: {
        params: ParamsModel,
        headers: zod.object({
          [authHeaderName]: zod.string({
            required_error: 'Hive CDN authentication key is missing',
          }),
          'if-none-match': zod.string().optional(),
        }),
      },
    },
    handler: [
      async request => {
        const headerKey = request.headers.get(authHeaderName);

        const isValid = await deps.isKeyValid(request.params.targetId, headerKey);

        if (!isValid) {
          return createInvalidAuthKeyResponse(analytics);
        }
      },
      async (request, captureException) => {
        /** Legacy handling for old client SDK versions. */
        if (request.params.artifactType === 'schema') {
          return Response.redirect(request.url.replace('/schema', '/services'), 301);
        }

        analytics.track(
          { type: 'artifact', value: request.params.artifactType, version: 'v1' },
          request.params.targetId,
        );

        const eTag = request.headers.get('if-none-match');

        const result = await deps
          .getArtifactAction(request.params.targetId, request.params.artifactType, eTag)
          .catch(error => {
            if (deps.fallback) {
              if (isCaptureException(captureException)) {
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
            deps.fallback?.(request, request.params) ??
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
          return Response.redirect(result.location, 302);
        }
      },
    ],
  });
};
