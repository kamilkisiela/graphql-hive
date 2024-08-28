import zod from 'zod';
import type { Analytics } from './analytics';
import { AwsClient } from './aws';

export function buildArtifactStorageKey(
  targetId: string,
  artifactType: string,
  contractName: null | string,
) {
  const parts = ['artifact', targetId];
  if (contractName) {
    parts.push('contracts', contractName);
  }
  parts.push(artifactType);
  return parts.join('/');
}

type SDLArtifactTypes = `sdl${'.graphql' | '.graphqls' | ''}`;

export type ArtifactsType = SDLArtifactTypes | 'metadata' | 'services' | 'supergraph';

/** Timeout in milliseconds for S3 read calls. */
const READ_TIMEOUT_MS = 5_000;

const OperationS3BucketKeyModel = zod.tuple([
  zod.string().uuid(),
  zod.string().min(1),
  zod.string().min(1),
  zod.string().min(1),
]);

/**
 * S3 key for stored operation body (used by CDN).
 * Note: we validate to avoid invalid keys / collisions that could be caused by type errors.
 **/
export function buildOperationS3BucketKey(
  ...args: [targetId: string, appName: string, appVersion: string, hash: string]
) {
  return ['app', ...OperationS3BucketKeyModel.parse(args)].join('/');
}

const AppDeploymentIsEnabledKeyModel = zod.tuple([
  zod.string().uuid(),
  zod.string().min(1),
  zod.string().min(1),
]);

/**
 * S3 key for determining whether app deployment is enabled or not.
 * Note: we validate to avoid invalid keys / collisions that could be caused by type errors.
 **/
export function buildAppDeploymentIsEnabledKey(
  ...args: [targetId: string, appName: string, appVersion: string]
) {
  return ['apps-enabled', ...AppDeploymentIsEnabledKeyModel.parse(args)].join('/');
}

/**
 * Read an artifact/app deployment operation from S3.
 */
export class ArtifactStorageReader {
  constructor(
    private s3: {
      client: AwsClient;
      endpoint: string;
      bucketName: string;
    },
    // private s3Mirror: {
    //   client: AwsClient;
    //   endpoint: string;
    //   bucketName: string;
    // },
    private analytics: Analytics | null,
  ) {}

  /** Read an artifact from S3 */
  async readArtifact(
    targetId: string,
    contractName: string | null,
    artifactType: ArtifactsType,
    etagValue: string | null,
  ) {
    if (artifactType.startsWith('sdl')) {
      artifactType = 'sdl';
    }

    const key = buildArtifactStorageKey(targetId, artifactType, contractName);

    const headers: HeadersInit = {};

    if (etagValue) {
      headers['if-none-match'] = etagValue;
    }

    const response = await this.s3.client.fetch(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'GET',
        headers,
        aws: {
          signQuery: true,
        },
        timeout: READ_TIMEOUT_MS,
      },
    );

    this.analytics?.track(
      {
        type: 'r2',
        statusCode: response.status,
        action: 'GET artifact',
      },
      targetId,
    );

    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }

    if (response.status === 304) {
      return {
        type: 'notModified',
      } as const;
    }

    if (response.status === 200) {
      return {
        type: 'response',
        response,
      } as const;
    }

    const body = await response.text();
    throw new Error(`GET request failed with status ${response.status}: ${body}`);
  }

  async isAppDeploymentEnabled(targetId: string, appName: string, appVersion: string) {
    const key = buildAppDeploymentIsEnabledKey(targetId, appName, appVersion);

    const response = await this.s3.client.fetch(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'HEAD',
        aws: {
          signQuery: true,
        },
        timeout: READ_TIMEOUT_MS,
      },
    );
    this.analytics?.track(
      {
        type: 'r2',
        statusCode: response.status,
        action: 'HEAD appDeploymentIsEnabled',
      },
      targetId,
    );

    return response.status === 200;
  }

  async loadAppDeploymentPersistedOperation(
    targetId: string,
    appName: string,
    appVersion: string,
    hash: string,
    etagValue: string | null,
  ) {
    const key = buildOperationS3BucketKey(targetId, appName, appVersion, hash);

    const headers: Record<string, string> = {};
    if (etagValue) {
      headers['if-none-match'] = etagValue;
    }

    const response = await this.s3.client.fetch(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'GET',
        aws: {
          signQuery: true,
        },
        headers,
        timeout: READ_TIMEOUT_MS,
      },
    );

    this.analytics?.track(
      {
        type: 'r2',
        statusCode: response.status,
        action: 'GET persistedOperation',
      },
      targetId,
    );

    if (etagValue && response.status === 304) {
      return { type: 'notModified' } as const;
    }

    if (response.status === 200) {
      const body = await response.text();
      return {
        type: 'body',
        body,
      } as const;
    }

    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }

    const body = await response.text();
    throw new Error(`HEAD request failed with status ${response.status}: ${body}`);
  }
}
