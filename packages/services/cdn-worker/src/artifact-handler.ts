import type { KeyValidator } from './key-validation';
import { Response, type Request } from '@whatwg-node/fetch';
import itty from 'itty-router';
import zod from 'zod';
import { InvalidAuthKeyResponse, MissingAuthKeyResponse } from './errors';

type ArtifactRequestHandler = {
  getArtifactUrl: (
    targetId: string,
    artifactType: 'metadata' | 'sdl' | 'services' | 'supergraph',
  ) => Promise<string | null>;
  isKeyValid: KeyValidator;
};

const ParamsModel = zod.object({
  targetId: zod.string(),
  artifactType: zod.union([
    zod.literal('metadata'),
    zod.literal('sdl'),
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
    const params = ParamsModel.parse(request.params);
    const maybeResponse = await authenticate(request, params.targetId);
    if (maybeResponse !== null) {
      return maybeResponse;
    }

    const artifactUrl = await deps.getArtifactUrl(params.targetId, params.artifactType);

    if (!artifactUrl) {
      return new Response('Not found.', { status: 404 });
    }

    return new Response('Found.', { status: 302, headers: { Location: artifactUrl } });
  });

  return (request: Request) => router.handle(request);
};
