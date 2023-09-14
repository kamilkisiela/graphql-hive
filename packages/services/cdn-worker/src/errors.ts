import { Response } from '@whatwg-node/fetch';
import { Analytics } from './analytics';

const description = `Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage`;

export class MissingTargetIDErrorResponse extends Response {
  constructor(analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'MISSING_TARGET_ID',
        error: `Missing Hive target ID in request params.`,
        description,
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    analytics.track({ type: 'error', value: ['missing_target_id'] }, 'unknown');
    analytics.track(
      {
        type: 'response',
        statusCode: 400,
      },
      'unknown',
    );
  }
}

export class InvalidArtifactTypeResponse extends Response {
  constructor(artifactType: string, analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'INVALID_ARTIFACT_TYPE',
        error: `Invalid artifact type: "${artifactType}"`,
        description,
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['invalid_artifact_type', artifactType] }, 'unknown');
    analytics.track(
      {
        type: 'response',
        statusCode: 400,
      },
      'unknown',
    );
  }
}

export class MissingAuthKeyResponse extends Response {
  constructor(analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'MISSING_AUTH_KEY',
        error: `Hive CDN authentication key is missing`,
        description,
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['missing_auth_key'] }, 'unknown');
    analytics.track(
      {
        type: 'response',
        statusCode: 400,
      },
      'unknown',
    );
  }
}

export class InvalidAuthKeyResponse extends Response {
  constructor(analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'INVALID_AUTH_KEY',
        error: `Hive CDN authentication key is invalid, or it does not match the requested target ID.`,
        description,
      }),
      {
        status: 403,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['invalid_auth_key'] }, 'unknown');
    analytics.track(
      {
        type: 'response',
        statusCode: 403,
      },
      'unknown',
    );
  }
}

export class CDNArtifactNotFound extends Response {
  constructor(artifactType: string, targetId: string, analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'NOT_FOUND',
        error: `Hive CDN was unable to find an artifact of type "${artifactType}" for target "${targetId}"`,
        description,
      }),
      {
        status: 404,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['artifact_not_found', artifactType] }, targetId);
    analytics.track(
      {
        type: 'response',
        statusCode: 404,
      },
      targetId,
    );
  }
}

export class InvalidArtifactMatch extends Response {
  constructor(artifactType: string, targetId: string, analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'INVALID_ARTIFACT_MATCH',
        error: `Target "${targetId}" does not support the artifact type "${artifactType}"`,
        description,
      }),
      {
        status: 400,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['invalid_artifact_match', artifactType] }, targetId);
    analytics.track(
      {
        type: 'response',
        statusCode: 400,
      },
      targetId,
    );
  }
}

export class UnexpectedError extends Response {
  constructor(analytics: Analytics) {
    super(
      JSON.stringify({
        code: 'UNEXPECTED_ERROR',
        error: `Please try again later, or contact Hive support if the problem persists.`,
        description,
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
    analytics.track({ type: 'error', value: ['unexpected_error'] }, 'unknown');
    analytics.track(
      {
        type: 'response',
        statusCode: 500,
      },
      'unknown',
    );
  }
}
