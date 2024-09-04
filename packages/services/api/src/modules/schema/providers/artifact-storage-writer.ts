import { Inject } from 'graphql-modules';
import { buildArtifactStorageKey } from '@hive/cdn-script/artifact-storage-reader';
import { traceFn } from '@hive/service-common';
import { Logger } from '../../shared/providers/logger';
import { S3_CONFIG, type S3Config } from '../../shared/providers/s3-config';

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
  private logger: Logger;

  constructor(
    @Inject(S3_CONFIG) private s3Mirrors: S3Config,
    logger: Logger,
  ) {
    this.logger = logger.child({ service: 'f' });
  }

  @traceFn('CDN: Write Artifact', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.artifact.type': args.artifactType,
      'hive.contract.name': args.contractName || '',
    }),
  })
  async writeArtifact(args: {
    targetId: string;
    artifactType: keyof typeof artifactMeta;
    artifact: unknown;
    contractName: null | string;
  }) {
    const key = buildArtifactStorageKey(args.targetId, args.artifactType, args.contractName);
    const meta = artifactMeta[args.artifactType];

    for (const s3 of this.s3Mirrors) {
      const result = await s3.client.fetch([s3.endpoint, s3.bucket, key].join('/'), {
        method: 'PUT',
        headers: {
          'content-type': meta.contentType,
        },
        body: meta.preprocessor(args.artifact),
        aws: {
          // This boolean makes Google Cloud Storage & AWS happy.
          signQuery: true,
        },
      });

      if (result.statusCode !== 200) {
        throw new Error(`Unexpected status code ${result.statusCode} when writing artifact.`);
      }
    }
  }

  @traceFn('CDN: Delete Artifact', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.artifact.type': args.artifactType,
      'hive.contract.name': args.contractName || '',
    }),
  })
  async deleteArtifact(args: {
    targetId: string;
    artifactType: keyof typeof artifactMeta;
    contractName: null | string;
  }) {
    this.logger.debug(
      'Attempt deleting artifact. (targetId=%s, contractName=%s, artifactType=%s)',
      args.targetId,
      args.artifactType,
      args.contractName,
    );
    const key = buildArtifactStorageKey(args.targetId, args.artifactType, args.contractName);

    for (const s3 of this.s3Mirrors) {
      const result = await s3.client.fetch([s3.endpoint, s3.bucket, key].join('/'), {
        method: 'DELETE',
        aws: {
          // This boolean makes Google Cloud Storage & AWS happy.
          signQuery: true,
        },
      });

      if (result.statusCode !== 204) {
        this.logger.debug(
          'Failed deleting artifact, S3 compatible storage returned unexpected status code. (targetId=%s, contractName=%s, artifactType=%s, statusCode=%s)',
          args.targetId,
          args.artifactType,
          args.contractName,
          result.statusCode,
        );
        throw new Error(`Unexpected status code ${result.statusCode} when deleting artifact.`);
      }
    }

    this.logger.debug(
      'Successfully deleted artifact. (targetId=%s, contractName=%s, artifactType=%s)',
      args.targetId,
      args.artifactType,
      args.contractName,
    );
  }
}
