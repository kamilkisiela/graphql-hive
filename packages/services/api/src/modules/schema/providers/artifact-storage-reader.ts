/**
 * IMPORTANT NOTE: This file needs to be kept platform-agnostic, don't use any Node.js specific APIs.
 */
import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fetch } from '@whatwg-node/fetch';

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
    private s3Client: S3Client,
    private bucketName: string,
    /** The public URL in case the public S3 endpoint differs from the internal S3 endpoint. E.g. within a docker network. */
    publicUrl: string | null,
  ) {
    this.publicUrl = publicUrl ? new URL(publicUrl) : null;
  }

  private async generatePresignedGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: presignedUrlExpirationSeconds,
    });

    if (!this.publicUrl) {
      return presignedUrl;
    }

    const publicUrl = new URL(presignedUrl);
    publicUrl.protocol = this.publicUrl.protocol;
    publicUrl.host = this.publicUrl.host;
    publicUrl.port = this.publicUrl.port;

    return publicUrl.toString();
  }

  /** Generate a pre-signed url for reading an artifact from a bucket for a limited time period. */
  async generateArtifactReadUrl(
    targetId: string,
    artifactType: ArtifactsType,
  ): Promise<string | null> {
    if (artifactType.startsWith('sdl')) {
      artifactType = 'sdl';
    }

    const key = buildArtifactStorageKey(targetId, artifactType);

    // In case you are wondering why we generate a pre-signed URL for doing the HEAD
    // request instead of just run the command with the AWS SDK:
    // The S3 client is not platform agnostic and will fail when
    // executed from within a Cloudflare Worker.
    // Signing, on the other hand, is platform agnostic.
    // AWS does not seem to fix this any time soon.
    // See https://github.com/aws/aws-sdk-js-v3/issues/3104

    const headCommand = await getSignedUrl(
      this.s3Client,
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );

    const response = await fetch(headCommand, {
      method: 'HEAD',
    });

    if (response.status === 200) {
      return await this.generatePresignedGetUrl(key);
    } else if (response.status === 404) {
      return null;
    } else {
      const body = await response.text();
      throw new Error(`HEAD request failed with status ${response.status}: ${body}`);
    }
  }
}
