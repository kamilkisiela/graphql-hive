import type { KeyValidator } from './key-validation';
import { type Request, createFetch } from '@whatwg-node/fetch';
import itty from 'itty-router';
import zod from 'zod';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse } from './errors';
import type { ArtifactsType } from '@hive/api/src/modules/schema/providers/artifact-storage-reader';

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
};

const ParamsModel = zod.object({
  targetId: zod.string(),
  artifactType: zod.union([
    zod.literal('metadata'),
    zod.literal('sdl'),
    zod.literal('sdl.graphql'),
    zod.literal('sdl.graphqls'),
    zod.literal('services'),
    zod.literal('supergraph'),
  ]),
});

const authHeaderName = 'x-hive-cdn-key' as const;

export const createArtifactRequestHandler = (deps: ArtifactRequestHandler) => {
  const router = itty.Router<itty.Request & Request>();

  const authenticate = async (
    request: itty.Request & Request,
    targetId: string,
  ): Promise<Response | null> => {
    const headerKey = request.headers.get(authHeaderName);
    if (headerKey === null) {
      return new MissingAuthKeyResponse();
    }

    const isValid = await deps.isKeyValid(targetId, headerKey);

    if (isValid) {
      return null;
    }

    return new InvalidAuthKeyResponse();
  };

  router.get('/artifacts/v1/:targetId/:artifactType', async (request: itty.Request & Request) => {
    const parseResult = ParamsModel.safeParse(request.params);

    if (parseResult.success === false) {
      return new Response('Not found.', { status: 404 });
    }

    const params = parseResult.data;

    const maybeResponse = await authenticate(request, params.targetId);

    if (maybeResponse !== null) {
      return maybeResponse;
    }

    const eTag = request.headers.get('if-none-match');

    const result = await deps.getArtifactAction(params.targetId, params.artifactType, eTag);

    if (result.type === 'notModified') {
      return new Response('', {
        status: 304,
      });
    } else if (result.type === 'notFound') {
      return new Response('Not found.', { status: 404 });
    } else if (result.type === 'redirect') {
      return new Response('Found.', { status: 302, headers: { Location: result.location } });
    }
  });

  return (request: Request) => router.handle(request);
};
