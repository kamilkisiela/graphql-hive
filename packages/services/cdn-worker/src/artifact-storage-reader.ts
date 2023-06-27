import { AwsClient } from './aws';

const presignedUrlExpirationSeconds = 60;

export const buildArtifactStorageKey = (targetId: string, artifactType: string) =>
  `artifact/${targetId}/${artifactType}`;

type SDLArtifactTypes = `sdl${'.graphql' | '.graphqls' | ''}`;

export type ArtifactsType = SDLArtifactTypes | 'metadata' | 'services' | 'supergraph';

/**
 * Read an Artifact to an S3 bucket.
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
  ) {
    this.publicUrl = publicUrl ? new URL(publicUrl) : null;
  }

  private async generatePresignedGetUrl(key: string): Promise<string> {
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
      return signedUrl.url;
    }

    const publicUrl = new URL(signedUrl.url);
    publicUrl.protocol = this.publicUrl.protocol;
    publicUrl.host = this.publicUrl.host;
    publicUrl.port = this.publicUrl.port;

    return publicUrl.toString();
  }

  /** Generate a pre-signed url for reading an artifact from a bucket for a limited time period. */
  async generateArtifactReadUrl(
    targetId: string,
    artifactType: ArtifactsType,
    etagValue: string | null,
  ) {
    if (artifactType.startsWith('sdl')) {
      artifactType = 'sdl';
    }

    const key = buildArtifactStorageKey(targetId, artifactType);

    const response = await this.s3.client.fetch(
      [this.s3.endpoint, this.s3.bucketName, key].join('/'),
      {
        method: 'HEAD',
        aws: {
          signQuery: true,
        },
      },
    );

    if (response.status === 200) {
      if (etagValue && response.headers.get('etag') === etagValue) {
        return { type: 'notModified' } as const;
      }

      return { type: 'redirect', location: await this.generatePresignedGetUrl(key) } as const;
    }
    if (response.status === 404) {
      return { type: 'notFound' } as const;
    }
    const body = await response.text();
    throw new Error(`HEAD request failed with status ${response.status}: ${body}`);
  }
}
