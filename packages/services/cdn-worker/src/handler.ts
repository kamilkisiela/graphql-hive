import { crypto, Response,TextEncoder } from '@whatwg-node/fetch';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { Analytics, createAnalytics } from './analytics';
import {
  CDNArtifactNotFound,
  InvalidArtifactMatch,
  InvalidArtifactTypeResponse,
  InvalidAuthKeyResponse,
  MissingAuthKeyResponse,
  MissingTargetIDErrorResponse,
} from './errors';
import type { KeyValidator } from './key-validation';

async function createETag(value: string) {
  const myText = new TextEncoder().encode(value);
  const myDigest = await crypto.subtle.digest({ name: 'SHA-256' }, myText);
  const hashArray = Array.from(new Uint8Array(myDigest));

  return `"${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}"`;
}

type SchemaArtifact = {
  sdl: string;
  url?: string;
  name?: string;
  date?: string;
};

type ArtifactType = 'schema' | 'supergraph' | 'sdl' | 'metadata' | 'introspection';
const artifactTypes = ['schema', 'supergraph', 'sdl', 'metadata', 'introspection'] as const;

const createArtifactTypesHandlers = (
  analytics: Analytics,
): Record<
  ArtifactType,
  (targetId: string, artifactType: string, rawValue: string, etag: string) => Response
> => ({
  /**
   * Returns SchemaArtifact or SchemaArtifact[], same way as it's stored in the storage
   */
  schema: (targetId: string, artifactType: string, rawValue: string, etag: string) =>
    new Response(rawValue, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        etag,
      },
    }),
  /**
   * Returns Federation Supergraph, we store it as-is.
   */
  supergraph: (targetId: string, artifactType: string, rawValue: string, etag: string) =>
    new Response(rawValue, {
      status: 200,
      headers: {
        etag,
      },
    }),
  sdl: (targetId: string, artifactType: string, rawValue: string, etag: string) => {
    if (rawValue.startsWith('[')) {
      return new InvalidArtifactMatch(artifactType, targetId, analytics);
    }

    const parsed = JSON.parse(rawValue) as SchemaArtifact;

    return new Response(parsed.sdl, {
      status: 200,
      headers: {
        etag,
      },
    });
  },
  /**
   * Returns Metadata same way as it's stored in the storage
   */
  metadata: (targetId: string, artifactType: string, rawValue: string, etag: string) =>
    new Response(rawValue, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        etag,
      },
    }),
  introspection: (targetId: string, artifactType: string, rawValue: string, etag: string) => {
    if (rawValue.startsWith('[')) {
      return new InvalidArtifactMatch(artifactType, targetId, analytics);
    }

    const parsed = JSON.parse(rawValue) as SchemaArtifact;
    const rawSdl = parsed.sdl;
    const schema = buildSchema(rawSdl);
    const introspection = introspectionFromSchema(schema);

    return new Response(JSON.stringify(introspection), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        etag,
      },
    });
  },
});

const VALID_ARTIFACT_TYPES = artifactTypes;
const AUTH_HEADER_NAME = 'x-hive-cdn-key';

async function parseIncomingRequest(
  request: Request,
  keyValidator: KeyValidator,
  analytics: Analytics,
): Promise<
  | { error: Response }
  | {
      targetId: string;
      artifactType: ArtifactType;
      storageKeyType: string;
    }
> {
  const params = new URL(request.url).pathname.replace(/^\/+/, '/').split('/').filter(Boolean);
  const targetId = params[0];

  if (!targetId) {
    return {
      error: new MissingTargetIDErrorResponse(analytics),
    };
  }

  const artifactType = (params[1] || 'schema') as ArtifactType;

  if (!VALID_ARTIFACT_TYPES.includes(artifactType)) {
    return { error: new InvalidArtifactTypeResponse(artifactType, analytics) };
  }

  const headerKey = request.headers.get(AUTH_HEADER_NAME);

  if (!headerKey) {
    return { error: new MissingAuthKeyResponse(analytics) };
  }

  try {
    const keyValid = await keyValidator(targetId, headerKey);

    if (!keyValid) {
      return {
        error: new InvalidAuthKeyResponse(analytics),
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
    console.warn(`Failed to validate key for ${targetId}, error:`, e);
    return {
      error: new InvalidAuthKeyResponse(analytics),
    };
  }
}

/**
 * Handler for verifying whether an access key is valid.
 */
type IsKeyValid = (targetId: string, headerKey: string) => Promise<boolean>;

/**
 * Read a raw value from the store.
 */
type GetRawStoreValue = (targetId: string) => Promise<string | null>;

interface RequestHandlerDependencies {
  isKeyValid: IsKeyValid;
  getRawStoreValue: GetRawStoreValue;
  analytics?: Analytics;
}

export const createRequestHandler = (deps: RequestHandlerDependencies) => {
  const analytics = deps.analytics ?? createAnalytics();
  const artifactTypesHandlers = createArtifactTypesHandlers(analytics);

  return async (request: Request): Promise<Response> => {
    const parsedRequest = await parseIncomingRequest(request, deps.isKeyValid, analytics);

    if ('error' in parsedRequest) {
      return parsedRequest.error;
    }

    const { targetId, artifactType, storageKeyType } = parsedRequest;

    analytics.track({ type: 'artifact', value: artifactType, version: 'v0' }, targetId);

    const kvStorageKey = `target:${targetId}:${storageKeyType}`;
    const rawValue = await deps.getRawStoreValue(kvStorageKey);

    if (rawValue) {
      const etag = await createETag(`${kvStorageKey}|${rawValue}`);
      const ifNoneMatch = request.headers.get('if-none-match');

      if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, { status: 304 });
      }

      switch (artifactType) {
        case 'schema':
          return artifactTypesHandlers.schema(targetId, artifactType, rawValue, etag);
        case 'supergraph':
          return artifactTypesHandlers.supergraph(targetId, artifactType, rawValue, etag);
        case 'sdl':
          return artifactTypesHandlers.sdl(targetId, artifactType, rawValue, etag);
        case 'introspection':
          return artifactTypesHandlers.introspection(targetId, artifactType, rawValue, etag);
        case 'metadata':
          return artifactTypesHandlers.metadata(targetId, artifactType, rawValue, etag);
        default:
          return new Response(null, {
            status: 500,
          });
      }
    } else {
      console.log(
        `CDN Artifact not found for targetId=${targetId}, artifactType=${artifactType}, storageKeyType=${storageKeyType}`,
      );
      return new CDNArtifactNotFound(artifactType, targetId, analytics);
    }
  };
};
