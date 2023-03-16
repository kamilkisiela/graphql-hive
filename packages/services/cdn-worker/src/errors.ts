import { Response } from 'fets';
import { Analytics } from './analytics';

const description = `Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage`;

export function createMissingTargetIDErrorResponse(analytics: Analytics) {
  analytics.track({ type: 'error', value: ['missing_target_id'] }, 'unknown');
  return Response.json(
    {
      code: 'MISSING_TARGET_ID',
      error: `Missing Hive target ID in request params.`,
      description,
    },
    {
      status: 400,
    },
  );
}

export function createInvalidArtifactTypeResponse(artifactType: string, analytics: Analytics) {
  analytics.track({ type: 'error', value: ['invalid_artifact_type', artifactType] }, 'unknown');
  return Response.json(
    {
      code: 'INVALID_ARTIFACT_TYPE',
      error: `Invalid artifact type: "${artifactType}"`,
      description,
    },
    {
      status: 400,
    },
  );
}

export function createMissingAuthKeyResponse(analytics: Analytics) {
  analytics.track({ type: 'error', value: ['missing_auth_key'] }, 'unknown');
  return Response.json(
    {
      code: 'MISSING_AUTH_KEY',
      error: `Hive CDN authentication key is missing`,
      description,
    },
    {
      status: 400,
    },
  );
}

export function createInvalidAuthKeyResponse(analytics: Analytics) {
  analytics.track({ type: 'error', value: ['invalid_auth_key'] }, 'unknown');
  return Response.json(
    {
      code: 'INVALID_AUTH_KEY',
      error: `Hive CDN authentication key is invalid, or it does not match the requested target ID.`,
      description,
    },
    {
      status: 403,
    },
  );
}

export function createCDNArtifactNotFoundResponse(
  artifactType: string,
  targetId: string,
  analytics: Analytics,
) {
  analytics.track({ type: 'error', value: ['artifact_not_found', artifactType] }, targetId);
  return Response.json(
    {
      code: 'NOT_FOUND',
      error: `Hive CDN was unable to find an artifact of type "${artifactType}" for target "${targetId}"`,
      description,
    },
    {
      status: 404,
    },
  );
}

export function createInvalidArtifactMatchResponse(
  artifactType: string,
  targetId: string,
  analytics: Analytics,
) {
  analytics.track({ type: 'error', value: ['invalid_artifact_match', artifactType] }, targetId);
  return Response.json(
    {
      code: 'INVALID_ARTIFACT_MATCH',
      error: `Target "${targetId}" does not support the artifact type "${artifactType}"`,
      description,
    },
    {
      status: 400,
    },
  );
}

export function createUnexpectedErrorResponse(analytics: Analytics) {
  analytics.track({ type: 'error', value: ['unexpected_error'] }, 'unknown');
  return Response.json(
    {
      code: 'UNEXPECTED_ERROR',
      error: `Please try again later, or contact Hive support if the problem persists.`,
      description,
    },
    {
      status: 500,
    },
  );
}
