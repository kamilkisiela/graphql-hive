import type { Analytics } from './analytics';
import { AwsClient } from './aws';

const presignedUrlExpirationSeconds = 60;

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

/** S3 key for stored operation body (used by CDN). */
export function buildOperationS3BucketKey(
  targetId: string,
  appName: string,
  appVersion: string,
  hash: string,
) {
  return ['app', targetId, appName, appVersion, hash].join('/');
}

/** S3 key for determining whether app deployment is enabled or not. */
export function buildAppDeploymentIsEnabledKey(
  targetId: string,
  appName: string,
  appVersion: string,
) {
  return ['apps-enabled', targetId, appName, appVersion].join('/');
}

/**
 * Read an artifact/app deployment operation from S3.
 */
export class ArtifactStorageReader {
  private publicUrl: URL | null;

  constructor(
    private s3: {
      client: AwsClient;
      endpoint: string;
      bucketName: string;
    },
    /** The public URL in case the public S3 endpoint differs from the internal S3 endpoint. E.g. within a docker network. */
    publicUrl: string | null,
    private analytics: Analytics | null,
  ) {
    this.publicUrl = publicUrl ? new URL(publicUrl) : null;
  }

  private async generatePresignedGetUrl(key: string): Promise<{
    public: string;
    private: string;
  }> {
    const signedUrl = await this.s3.client.sign(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'GET',
        aws: { signQuery: true },
        headers: {
          'X-Amz-Expires': String(presignedUrlExpirationSeconds),
        },
      },
    );

    if (!this.publicUrl) {
      return {
        public: signedUrl.url,
        private: signedUrl.url,
      };
    }

    const publicUrl = new URL(signedUrl.url);
    publicUrl.protocol = this.publicUrl.protocol;
    publicUrl.host = this.publicUrl.host;
    publicUrl.port = this.publicUrl.port;

    return {
      public: publicUrl.toString(),
      private: signedUrl.url,
    };
  }

  /** Generate a pre-signed url for reading an artifact from a bucket for a limited time period. */
  async generateArtifactReadUrl(
    targetId: string,
    contractName: string | null,
    artifactType: ArtifactsType,
    etagValue: string | null,
  ) {
    if (artifactType.startsWith('sdl')) {
      artifactType = 'sdl';
    }

    const key = buildArtifactStorageKey(targetId, artifactType, contractName);

    const response = await this.s3.client.fetch(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'HEAD',
        aws: {
          signQuery: true,
        },
      },
    );
    this.analytics?.track(
      {
        type: 'r2',
        statusCode: response.status,
        action: 'HEAD artifact',
      },
      targetId,
    );

    if (response.status === 200) {
      if (etagValue && response.headers.get('etag') === etagValue) {
        return { type: 'notModified' } as const;
      }

      return {
        type: 'redirect',
        location: await this.generatePresignedGetUrl(key),
      } as const;
    }
    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }
    const body = await response.text();
    throw new Error(`HEAD request failed with status ${response.status}: ${body}`);
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
