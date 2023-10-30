import { Job, Worker } from 'bullmq';
import type { Redis as RedisInstance } from 'ioredis';
import { type DatabasePool } from 'slonik';
import { AwsClient } from '@hive/cdn-script/aws';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { Static, Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';

const JobSchema = Type.Object({
  task: Type.Union([
    Type.Literal('rollout', {
      description: 'A persisted document deployment should be rolled out.',
    }),
    Type.Literal('delete', {
      description: 'A persisted document deployment should be deleted.',
    }),
  ]),
  requestId: Type.String({
    description: 'The request id that enqueued the job.',
  }),
  persistedDeploymentId: Type.String({
    format: 'uuid',
    description: 'The id of the persisted deployment.',
  }),
});

const JobModel = TypeCompiler.Compile(JobSchema);

export class PersistedDocumentsWorker {
  private logger: FastifyLoggerInstance;
  private s3Client: AwsClient;
  private s3: {
    endpoint: string;
    bucket: string;
  };

  constructor(
    s3: {
      credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string | null;
      };
      bucketName: string;
      endpoint: string;
    },
    private pgPool: DatabasePool,
    private redis: RedisInstance,
    logger: FastifyLoggerInstance,
    private _onError: (error: Error) => void,
  ) {
    this.logger = logger.child({
      name: 'PersistedDocumentsWorker',
    });
    this.s3Client = new AwsClient({
      accessKeyId: s3.credentials.accessKeyId,
      secretAccessKey: s3.credentials.secretAccessKey,
      sessionToken: s3.credentials.sessionToken ?? undefined,
      service: 's3',
    });
    this.s3 = {
      bucket: s3.bucketName,
      endpoint: s3.endpoint,
    };
  }

  private async processJob(_job: Static<typeof JobSchema>): Promise<void> {
    throw new Error('Not implemented.');
  }

  private _onFailedJob(job: Job<unknown> | undefined, error: Error) {
    this.logger.debug(
      `Job %s failed after %s attempts, reason: %s`,
      job?.name,
      job?.attemptsMade,
      job?.failedReason,
    );
    this.logger.error(error);
  }

  async start() {
    const prefix = 'persisted-documents';

    const worker = new Worker<unknown>(
      prefix,
      job => {
        return this.processJob(JobModel.Decode(job.data));
      },
      {
        prefix,
        connection: this.redis,
        sharedConnection: true,
      },
    );

    worker.on('error', this._onError);
    worker.on('failed', this._onFailedJob);

    // Wait for Workers
    await worker.waitUntilReady();

    return async function stop() {
      await worker.close();
    };
  }
}
