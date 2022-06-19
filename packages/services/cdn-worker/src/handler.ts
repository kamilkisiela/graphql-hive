import {
  CDNArtifactNotFound,
  InvalidArtifactMatch,
  InvalidArtifactTypeResponse,
  InvalidAuthKey,
  MissingAuthKey,
  MissingTargetIDErrorResponse,
} from './errors';
import { isKeyValid } from './auth';
import { buildSchema, introspectionFromSchema } from 'graphql';

type SchemaArtifact = {
  sdl: string;
  url?: string;
  name?: string;
  date?: string;
};

const artifactTypesHandlers = {
  /**
   * Returns SchemaArtifact or SchemaArtifact[], same way as it's stored in the storage
   */
  schema: (targetId: string, artifactType: string, rawValue: string) => new Response(rawValue, { status: 200 }),
  /**
   * Returns Federation Supergraph, we store it as-is.
   */
  supergraph: (targetId: string, artifactType: string, rawValue: string) => new Response(rawValue, { status: 200 }),
  sdl: (targetId: string, artifactType: string, rawValue: string) => {
    if (rawValue.startsWith('[')) {
      return new InvalidArtifactMatch(artifactType, targetId);
    }

    const parsed = JSON.parse(rawValue) as SchemaArtifact;

    return new Response(parsed.sdl, { status: 200 });
  },
  /**
   * Returns Metadata same way as it's stored in the storage
   */
  metadata: (targetId: string, artifactType: string, rawValue: string) =>
    new Response(rawValue, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  introspection: (targetId: string, artifactType: string, rawValue: string) => {
    if (rawValue.startsWith('[')) {
      return new InvalidArtifactMatch(artifactType, targetId);
    }

    const parsed = JSON.parse(rawValue) as SchemaArtifact;
    const rawSdl = parsed.sdl;
    const schema = buildSchema(rawSdl);
    const introspection = introspectionFromSchema(schema);

    return new Response(JSON.stringify(introspection), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
};

const VALID_ARTIFACT_TYPES = Object.keys(artifactTypesHandlers);
const AUTH_HEADER_NAME = 'x-hive-cdn-key';

async function parseIncomingRequest(
  request: Request,
  keyValidator: typeof isKeyValid
): Promise<
  | { error: Response }
  | {
      targetId: string;
      artifactType: keyof typeof artifactTypesHandlers;
      storageKeyType: string;
    }
> {
  const params = new URL(request.url).pathname.replace(/^\/+/, '/').split('/').filter(Boolean);
  const targetId = params[0];

  if (!targetId) {
    return {
      error: new MissingTargetIDErrorResponse(),
    };
  }

  const artifactType = (params[1] || 'schema') as keyof typeof artifactTypesHandlers;

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    return { error: new InvalidArtifactTypeResponse(artifactType) };
  }

  const headerKey = request.headers.get(AUTH_HEADER_NAME);

  if (!headerKey) {
    return { error: new MissingAuthKey() };
  }

  try {
    const keyValid = await keyValidator(targetId, headerKey);

    if (!keyValid) {
      return {
        error: new InvalidAuthKey(),
      };
    }

    return {
      targetId,
      artifactType,
      storageKeyType:
        artifactType === 'sdl' || artifactType === 'introspection' || artifactType === 'schema'
          ? 'schema'
          : artifactType,
    };
  } catch (e) {
    return {
      error: new InvalidAuthKey(),
    };
  }
}

export async function handleRequest(request: Request, keyValidator: typeof isKeyValid) {
  const parsedRequest = await parseIncomingRequest(request, keyValidator);

  if ('error' in parsedRequest) {
    return parsedRequest.error;
  }

  const { targetId, artifactType, storageKeyType } = parsedRequest;

  const kvStorageKey = `target:${targetId}:${storageKeyType}`;
  const rawValue = await HIVE_DATA.get(kvStorageKey);

  if (rawValue) {
    switch (artifactType) {
      case 'schema':
        return artifactTypesHandlers.schema(targetId, artifactType, rawValue);
      case 'supergraph':
        return artifactTypesHandlers.supergraph(targetId, artifactType, rawValue);
      case 'sdl':
        return artifactTypesHandlers.sdl(targetId, artifactType, rawValue);
      case 'introspection':
        return artifactTypesHandlers.introspection(targetId, artifactType, rawValue);
      case 'metadata':
        return artifactTypesHandlers.metadata(targetId, artifactType, rawValue);
      default:
        return new Response(null, {
          status: 500,
        });
    }
  } else {
    console.log(
      `CDN Artifact not found for targetId=${targetId}, artifactType=${artifactType}, storageKeyType=${storageKeyType}`
    );
    return new CDNArtifactNotFound(artifactType, targetId);
  }
}
