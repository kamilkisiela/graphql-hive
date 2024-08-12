import { Logger, makeWorkerUtils } from 'graphile-worker';
import { z, ZodSchema } from 'zod';
import type { Storage } from '@hive/api';
import { ensureMonthlyDedupeKey, rollbackMonthlyDedupeKey } from './lib/monthly-deduplication.js';
import { SpecSchema } from './lib/trpc.js';
import type { TaskSchemas } from './tasks.js';

export type TaskClient = Awaited<ReturnType<typeof createTaskClient>>;

type CustomLogger = Record<
  'debug' | 'info' | 'warn' | 'error',
  (msg: string, meta?: Record<string, any>) => void
> & {
  child(bindings: Record<string, any>): CustomLogger;
};

type ZInferOrNull<T extends ZodSchema | null> = T extends ZodSchema ? z.infer<T> : null;

export async function createTaskClient(config: { pool: Storage['pool']; logger: CustomLogger }) {
  const logger = new Logger(scope => {
    const serviceLogger = config.logger.child(scope);
    return (level, msg, meta) => {
      switch (level) {
        case 'debug':
          serviceLogger.debug(msg, meta);
          break;
        case 'info':
          serviceLogger.info(msg, meta);
          break;
        case 'warning':
          serviceLogger.warn(msg, meta);
          break;
        case 'error':
          serviceLogger.error(msg, meta);
          break;
      }
    };
  });

  const client = await makeWorkerUtils({
    schema: 'graphile_worker',
    logger,
    pgPool: config.pool.pool,
    useNodeTime: true,
  });

  return {
    async addJob<TaskName extends keyof TaskSchemas>(
      taskName: TaskName,
      payload: ZInferOrNull<TaskSchemas[TaskName]>,
      spec: z.infer<typeof SpecSchema>,
    ): Promise<void> {
      logger.debug(`Attempt to add a job "${taskName}"`, {
        requestId: spec.requestId,
      });
      const parsedSpec = SpecSchema.parse(spec);

      if (!parsedSpec?.monthlyDedupeKey) {
        await client.addJob(taskName, payload as any, parsedSpec);
        return;
      }

      const monthlyDedupeKey = parsedSpec.monthlyDedupeKey;
      if (monthlyDedupeKey) {
        if (await ensureMonthlyDedupeKey(config.pool, monthlyDedupeKey)) {
          logger.debug(`Found a fresh job with "${monthlyDedupeKey}" monthly key, skipping.`);
          return;
        }
      }

      try {
        await client.addJob(taskName, payload as any, parsedSpec);
        return;
      } catch (error) {
        if (monthlyDedupeKey) {
          await rollbackMonthlyDedupeKey(config.pool, monthlyDedupeKey);
        }

        throw error;
      }
    },
  };
}
