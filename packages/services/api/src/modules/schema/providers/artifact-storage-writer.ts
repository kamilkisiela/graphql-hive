import { Inject } from 'graphql-modules';
import { type S3Config, S3_CONFIG } from '../../shared/providers/s3-config';
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
  constructor(@Inject(S3_CONFIG) private s3: S3Config) {}

  async writeArtifact(args: {
    targetId: string;
    artifactType: keyof typeof artifactMeta;
    artifact: unknown;
  }) {
    const key = buildArtifactStorageKey(args.targetId, args.artifactType);
    const meta = artifactMeta[args.artifactType];

    const result = await this.s3.client.fetch([this.s3.endpoint, this.s3.bucket, key].join('/'), {
      method: 'PUT',
      headers: {
        'content-type': meta.contentType,
      },
      body: meta.preprocessor(args.artifact),
    });

    if (result.status !== 200) {
      throw new Error(`Unexpected status code ${result.status} when writing artifact.`);
    }
  }
}
