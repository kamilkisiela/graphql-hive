import { buildSchema, introspectionFromSchema } from 'graphql';
import { Analytics, createAnalytics } from './analytics';
import { GetArtifactActionFn } from './artifact-handler';
import { ArtifactsType as ModernArtifactsType } from './artifact-storage-reader';
import {
  CDNArtifactNotFound,
  InvalidArtifactTypeResponse,
  InvalidAuthKeyResponse,
  MissingAuthKeyResponse,
  MissingTargetIDErrorResponse,
} from './errors';
import type { KeyValidator } from './key-validation';
import { createResponse } from './tracked-response';

async function createETag(value: string) {
  const myText = new TextEncoder().encode(value);
  const myDigest = await crypto.subtle.digest({ name: 'SHA-256' }, myText);
  const hashArray = Array.from(new Uint8Array(myDigest));

  return `"${hashArray.map(b => b.toString(16).padStart(2, '0')).join('')}"`;
}

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
    createResponse(
      analytics,
      rawValue,
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          etag,
        },
      },
      targetId,
    ),
  /**
   * Returns Federation Supergraph, we store it as-is.
   */
  supergraph: (targetId: string, artifactType: string, rawValue: string, etag: string) =>
    createResponse(
      analytics,
      rawValue,
      {
        status: 200,
        headers: {
          etag,
        },
      },
      targetId,
    ),
  sdl: (targetId: string, artifactType: string, rawValue: string, etag: string) => {
    return createResponse(
      analytics,
      rawValue,
      {
        status: 200,
        headers: {
          etag,
        },
      },
      targetId,
    );
  },
  /**
   * Returns Metadata same way as it's stored in the storage
   */
  metadata: (targetId: string, artifactType: string, rawValue: string, etag: string) =>
    createResponse(
      analytics,
      rawValue,
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          etag,
        },
      },
      targetId,
    ),
  introspection: (targetId: string, artifactType: string, rawValue: string, etag: string) => {
    const schema = buildSchema(rawValue);
    const introspection = introspectionFromSchema(schema);

    return createResponse(
      analytics,
      JSON.stringify(introspection),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          etag,
        },
      },
      targetId,
    );
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
      storageKeyType: 'schema' | 'supergraph' | 'metadata';
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

interface RequestHandlerDependencies {
  isKeyValid: IsKeyValid;
  getArtifactAction: GetArtifactActionFn;
  analytics?: Analytics;
  fetchText: (url: string) => Promise<string>;
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

    // We need to map a non-existing legacy storage key to a modern one
    // to be able to read the value from the R2 storage.
    const artifactKeyToFetch: ModernArtifactsType =
      storageKeyType === 'schema' ? 'sdl' : storageKeyType;

    const kvStorageKey = `target:${targetId}:${storageKeyType}`;
    const rawValueAction = await deps
      .getArtifactAction(targetId, artifactKeyToFetch, null)
      .catch(() => {
        // Do an extra attempt to read the value from the store.
        // If we see that a single retry does not help, we should do a proper retry logic here.
        // Why not now? Because we do have a new implementation that is based on R2 storage and this change is simple enough.
        return deps.getArtifactAction(targetId, artifactKeyToFetch, null);
      });

    if (rawValueAction.type === 'redirect') {
      const rawValue = await deps
        .fetchText(rawValueAction.location)
        .catch(() => deps.fetchText(rawValueAction.location));

      const etag = await createETag(`${kvStorageKey}|${rawValue}`);
      const ifNoneMatch = request.headers.get('if-none-match');

      if (ifNoneMatch && ifNoneMatch === etag) {
        return createResponse(analytics, null, { status: 304 }, targetId);
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
          return createResponse(
            analytics,
            null,
            {
              status: 500,
            },
            targetId,
          );
      }
    } else {
      console.log(
        `CDN Artifact not found for targetId=${targetId}, artifactType=${artifactType}, storageKeyType=${storageKeyType}, modernStorageKeyType=${artifactKeyToFetch}`,
      );
      return new CDNArtifactNotFound(artifactType, targetId, analytics);
    }
  };
};
