import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { makeWorkerUtils, WorkerUtils, type JobHelpers, type Task } from 'graphile-worker';
import { z } from 'zod';
import { Logger } from '@graphql-hive/logger';
import { PostgresDatabasePool, psql } from '@hive/postgres';
import { bridgeGraphileLogger } from '@hive/pubsub';
import type { Context } from './context';

export type TaskDefinition<TName extends string, TModel> = {
  name: TName;
  schema: z.ZodTypeAny & { _output: TModel };
};

type TaskImplementationArgs<TPayload> = {
  input: TPayload;
  requestId?: string;
  context: Context;
  logger: Logger;
  helpers: JobHelpers;
};

export type TaskImplementation<TPayload> = (
  args: TaskImplementationArgs<TPayload>,
) => Promise<void>;

/**
 * Define a task
 */
export function defineTask<TName extends string, TModel>(
  workflow: TaskDefinition<TName, TModel>,
): TaskDefinition<TName, TModel> {
  return workflow;
}

/**
 * Implement a task.
 */
export function implementTask<TPayload>(
  taskDefinition: TaskDefinition<string, TPayload>,
  implementation: TaskImplementation<TPayload>,
): (context: Context) => [string, Task] {
  const schema = z.object({
    requestId: z.string().optional(),
    input: taskDefinition.schema,
  });

  return function (context) {
    return [
      taskDefinition.name,
      function (unsafePayload, helpers) {
        const payload = schema.parse(unsafePayload);
        return implementation({
          input: payload.input,
          requestId: payload.requestId,
          context,
          helpers,
          logger: context.logger.child({
            'request.id': payload.requestId,
            'job.id': helpers.job.id,
            'job.queueId': helpers.job.job_queue_id,
            'job.attempts': helpers.job.attempts,
            'job.maxAttempts': helpers.job.max_attempts,
            'job.priority': helpers.job.priority,
            'job.taskId': helpers.job.task_id,
          }),
        });
      },
    ];
  };
}

/**
 * Schedule a tasks.
 */
export class TaskScheduler {
  tools: Promise<WorkerUtils>;
  cache: BentoCache<{ store: ReturnType<typeof bentostore> }>;

  constructor(
    private pgPool: PostgresDatabasePool,
    private logger: Logger = new Logger(),
  ) {
    this.tools = makeWorkerUtils({
      pgPool: pgPool.getPgPoolCompat(),
      logger: bridgeGraphileLogger(logger),
    });
    this.cache = new BentoCache({
      default: 'taskSchedule',
      stores: {
        taskSchedule: bentostore().useL1Layer(
          memoryDriver({
            maxItems: 10_000,
            prefix: 'bentocache:graphile_worker_deduplication',
          }),
        ),
      },
    });
  }

  async scheduleTask<TPayload>(
    taskDefinition: TaskDefinition<string, TPayload>,
    payload: TPayload,
    opts?: {
      requestId?: string;
      /** Ensures the task is scheduled only once. */
      dedupe?: {
        /** dedupe key for this task */
        key: string | ((payload: TPayload) => string);
        /** how long should the task be de-duped in milliseconds */
        ttl: number;
      };
    },
  ) {
    this.logger.info(
      {
        'job.taskId': taskDefinition.name,
      },
      'attempt enqueue task',
    );

    const input = taskDefinition.schema.parse(payload);
    const tools = await this.tools;

    if (opts?.dedupe) {
      const dedupeKey =
        typeof opts.dedupe.key === 'string' ? opts.dedupe.key : opts.dedupe.key(payload);
      const expiresAt = new Date(new Date().getTime() + opts.dedupe.ttl).toISOString();

      let shouldSkip = true;

      const { pgPool } = this;

      await this.cache.getOrSet({
        key: `${taskDefinition.name}:${dedupeKey}`,
        ttl: opts.dedupe.ttl,
        async factory() {
          const result = await pgPool.anyFirst(
            psql`
               INSERT INTO "graphile_worker_deduplication" ("task_name", "dedupe_key", "expires_at")
               VALUES(${taskDefinition.name}, ${dedupeKey}, ${expiresAt})
               ON CONFLICT ("task_name", "dedupe_key")
               DO
                 UPDATE SET "expires_at" = EXCLUDED.expires_at
                 WHERE "graphile_worker_deduplication"."expires_at" < NOW()
               RETURNING xmax = 0 AS "inserted"
             `,
          );

          shouldSkip = result.length === 0;
          return true;
        },
      });

      if (shouldSkip) {
        this.logger.info(
          {
            'job.taskId': taskDefinition.name,
          },
          'enqueue skipped due to dedupe',
        );
        return;
      }
    }

    const job = await tools.addJob(taskDefinition.name, {
      requestId: opts?.requestId,
      input,
    });

    this.logger.info(
      {
        'job.taskId': taskDefinition.name,
        'job.id': job.id,
      },
      'task enqueued.',
    );
  }
}
