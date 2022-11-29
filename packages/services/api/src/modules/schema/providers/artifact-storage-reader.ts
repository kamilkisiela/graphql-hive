import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fetch } from '@whatwg-node/fetch';

const presignedUrlExpirationSeconds = 60;

export const buildArtifactStorageKey = (targetId: string, artifactType: string) =>
  `artifact/${targetId}/${artifactType}`;

/**
 * Read an Artifact to an S3 bucket.
 */
export class ArtifactStorageReader {
  constructor(private s3Client: S3Client, private bucketName: string) {}

  private async generatePresignedGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: presignedUrlExpirationSeconds,
    });
  }

  /** Generate a pre-signed url for reading an artifact from a bucket for a limited time period. */
  async generateArtifactReadUrl(
    targetId: string,
    artifactType: 'sdl' | 'metadata' | 'services' | 'supergraph',
  ): Promise<string | null> {
    const key = buildArtifactStorageKey(targetId, artifactType);

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
