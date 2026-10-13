import { createHash } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import z from 'zod';
import { buildArtifactStorageKey } from '@hive/cdn-script/artifact-storage-reader';
import { setErrorSource, traceFn } from '@hive/service-common';
import { Logger } from '../../shared/providers/logger';
import { S3Writer } from '../../shared/providers/s3-writer';

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
  'manifest.json': {
    contentType: 'application/json',
    preprocessor: (rawValue: unknown) => JSON.stringify(rawValue),
  },
} as const;

function extractContractName(contractName: string | null): null | string {
  if (contractName === null) {
    return null;
  }
  const parts = contractName.split('/');

  return parts[parts.length - 1] ?? null;
}

/**
 * Write an Artifact to an S3 bucket.
 */
@Injectable({ scope: Scope.Singleton, global: true })
export class ArtifactStorageWriter {
  private logger: Logger;

  constructor(
    private s3: S3Writer,
    logger: Logger,
  ) {
    this.logger = logger.child({ service: 'f' });
  }

  @traceFn('CDN: Write Artifact', {
    initAttributes: args => ({
      'hive.target.id': args.targetId,
      'hive.artifact.type': args.artifactType,
      'hive.contract.name': args.contractName || '',
      'hive.version.id': args.versionId || '',
    }),
  })
  async writeArtifact(args: {
    targetId: string;
    artifactType: keyof typeof artifactMeta;
    artifact: unknown;
    contractName: null | string;
    versionId?: string | null;
    /** versioned contracts are historically stored under the source graph ID */
    contractSourceSchemaVersionId?: string | null;
    graphId?: string | null;
    /** When the artifact update was initiated. */
    referenceDate?: Date;
  }) {
    const latestKey = buildArtifactStorageKey(
      args.targetId,
      args.artifactType,
      extractContractName(args.contractName),
    );
    const storageVersionId = args.contractSourceSchemaVersionId ?? args.versionId;
    const versionedKey = storageVersionId
      ? buildArtifactStorageKey(
          args.targetId,
          args.artifactType,
          extractContractName(args.contractName),
          storageVersionId,
        )
      : null;
    const meta = artifactMeta[args.artifactType];
    const body = meta.preprocessor(args.artifact);

    this.logger.debug(
      'Writing artifact to S3 (targetId=%s, artifactType=%s, contractName=%s, versionId=%s, latestKey=%s, versionedKey=%s)',
      args.targetId,
      args.artifactType,
      args.contractName,
      args.versionId,
      latestKey,
      versionedKey,
    );

    const headers: Record<string, string> = {
      'content-type': meta.contentType,
    };

    if (args.referenceDate) {
      headers['x-amz-meta-x-hive-updated-at'] = args.referenceDate.toUTCString();
    }

    if (args.graphId) {
      headers['x-amz-meta-x-hive-graph-id'] = args.graphId;
    }

    // Write versioned key first (if versionId provided)
    // This order ensures that if versioned write fails, "latest" still points to the previous version
    if (versionedKey && args.versionId) {
      // Store version ID as S3 object metadata for CDN response headers
      headers['x-amz-meta-x-hive-graph-version-id'] = args.versionId;
      headers['x-amz-meta-x-hive-schema-version-id'] = args.versionId;

      if (args.artifactType !== 'manifest.json') {
        const versionedResults = await this.s3.write(versionedKey, 'artifact_versioned', {
          headers,
          body,
        });

        for (const versionedResult of versionedResults) {
          if (versionedResult.statusCode !== 200) {
            this.logger.error(
              'Failed to write versioned artifact (targetId=%s, artifactType=%s, versionId=%s, key=%s, statusCode=%s)',
              args.targetId,
              args.artifactType,
              args.versionId,
              versionedKey,
              versionedResult.statusCode,
            );
            throw setErrorSource(
              new Error(
                `Unexpected status code ${versionedResult.statusCode} when writing versioned artifact (targetId=${args.targetId}, artifactType=${args.artifactType}, versionId=${args.versionId}, key=${versionedKey})`,
              ),
              `s3 ${new URL(versionedResult.url).origin}`,
            );
          }
        }
      }
    }

    // Write to latest key (always) - only after versioned succeeds
    const latestResults = await this.s3.write(latestKey, 'artifact_latest', {
      headers,
      body,
    });

    for (const latestResult of latestResults) {
      if (latestResult.statusCode !== 200) {
        this.logger.error(
          'Failed to write latest artifact after versioned succeeded (targetId=%s, artifactType=%s, versionId=%s, versionedKey=%s written, latestKey=%s failed)',
          args.targetId,
          args.artifactType,
          args.versionId,
          versionedKey,
          latestKey,
        );
        throw setErrorSource(
          new Error(
            `Unexpected status code ${latestResult.statusCode} when writing latest artifact (targetId=${args.targetId}, artifactType=${args.artifactType}, contractName=${args.contractName}, key=${latestKey}). Note: versioned artifact was already written.`,
          ),
          `s3 ${new URL(latestResult.url).origin}`,
        );
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
    const key = buildArtifactStorageKey(
      args.targetId,
      args.artifactType,
      extractContractName(args.contractName),
    );

    const results = await this.s3.request(key, {
      method: 'DELETE',
    });

    for (const result of results) {
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

  async writeSDLForDebugPurposes(subgraphs: Array<{ sdl: string; name?: string }>) {
    const hashBuilder = createHash('sha256');
    for (const subgraph of subgraphs) {
      hashBuilder.update(subgraph.sdl);
      if (subgraph.name) {
        hashBuilder.update(subgraph.name);
      }
    }

    const hash = hashBuilder.digest('hex');

    const key = `debug-artifacts/${hash}.json`;
    const url = this.s3.primaryUrl(key);

    await this.s3.writePrimary(key, 'debug_artifact', {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(subgraphs),
    });

    return { id: hash.substring(0, 10), url };
  }
}

const GraphManifestGraph = z.object({
  id: z.string(),
  currentVersion: z.object({
    id: z.string(),
    artifactPath: z.string(),
  }),
});

const GraphManifestGraphs = z.record(GraphManifestGraph);

export const GraphManifestModel = z.object({ graphs: GraphManifestGraphs });
