import { type S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { buildArtifactStorageKey } from './artifact-storage-reader';

const artifactMeta = {
  sdl: {
    contentType: 'text/plain',
    preprocessor: (rawValue: unknown) => String(rawValue),
  },
  supergraph: {
    contentType: 'text/plain',
    preprocessor: (rawValue: unknown) => String(rawValue),
  },
  metadata: {
    contentType: 'application/json',
    preprocessor: (rawValue: unknown) => JSON.stringify(rawValue),
  },
  services: {
    contentType: 'application/json',
    preprocessor: (rawValue: unknown) => JSON.stringify(rawValue),
  },
} as const;

/**
 * Write an Artifact to an S3 bucket.
 */
export class ArtifactStorageWriter {
  constructor(private s3Client: S3Client, private bucketName: string) {}

  async writeArtifact(args: {
    targetId: string;
    artifactType: keyof typeof artifactMeta;
    artifact: unknown;
  }) {
    const key = buildArtifactStorageKey(args.targetId, args.artifactType);
    const meta = artifactMeta[args.artifactType];

    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: meta.contentType,
      Body: meta.preprocessor(args.artifact),
    });

    await this.s3Client.send(putCommand);
  }
}
