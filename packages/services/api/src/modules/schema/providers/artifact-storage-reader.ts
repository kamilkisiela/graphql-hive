import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound as S3NotFoundError,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const presignedUrlExpirationSeconds = 60;

export const buildArtifactStorageKey = (targetId: string, artifactType: string) =>
  `artifact/${targetId}/${artifactType}`;

/**
 * Read an Artifact to an S3 bucket.
 */
export class ArtifactStorageReader {
  constructor(private s3Client: S3Client, private bucketName: string) {}

  private async generatePresignedUrl(key: string): Promise<string> {
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

    const headCommand = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const result = await this.s3Client
      .send(headCommand)
      .then(result => ({ type: 'success', result } as const))
      .catch(error => {
        if (error instanceof S3NotFoundError) {
          return { type: 'error', error } as const;
        }
        // Anything else is an unexpected error.
        throw error;
      });

    if (result.type === 'error') {
      return null;
    }

    return await this.generatePresignedUrl(key);
  }
}
