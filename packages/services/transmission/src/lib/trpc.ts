import type { Runner } from 'graphile-worker';
import { z } from 'zod';
import { FastifyRequest, handleTRPCError } from '@hive/service-common';
import { initTRPC } from '@trpc/server';
import type { Storage } from '../../../api/src/modules/shared/providers/storage.js';
import { addJob, type TaskSchemas } from '../tasks.js';
import { ensureMonthlyDedupeKey, rollbackMonthlyDedupeKey } from './monthly-deduplication.js';

/**
 * Should be done only once per backend!
 */
export const t = initTRPC.context<TrpcContext>().create();
export const router = t.router;
export const publicProcedure = t.procedure.use(handleTRPCError);

const SpecSchema = z.object({
  maxAttempts: z
    .number()
    .optional()
    .describe('How many retries should this task get? (Default: 25)'),
  jobKey: z
    .string()
    .optional()
    .describe(
      'Unique identifier for the job, can be used to update or remove it later if needed. (Default: null)',
    ),
  jobKeyMode: z.enum(['replace', 'preserve_run_at', 'unsafe_dedupe']).optional().describe(`
    Modifies the behavior of "jobKey";
    when 'replace' all attributes will be updated,
    when 'preserve_run_at' all attributes except 'run_at' will be updated,
    when 'unsafe_dedupe' a new job will only be added if no existing job (including locked jobs and permanently failed jobs) with matching job key exists.
    (Default: 'replace')
  `),
  monthlyDedupeKey: z
    .string()
    .optional()
    .describe(
      'Should the job be persisted to the database for a month and new jobs with the same name be ignored? (Default: null)',
    ),
});

export type JobSpec = z.infer<typeof SpecSchema>;

export interface TrpcContext {
  runner: Runner;
  req: FastifyRequest;
  storage: Storage;
}

export function createProcedure<
  Name extends keyof TaskSchemas,
  ZodType extends NonNullable<TaskSchemas[Name]>,
>(taskSchemas: TaskSchemas, taskName: Name) {
  const payloadSchema = taskSchemas[taskName] as ZodType;
  return publicProcedure
    .input(
      z.object({
        payload: payloadSchema,
        spec: SpecSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input) {
        throw new Error('Input was not provided required');
      }

      const monthlyDedupeKey = input.spec.monthlyDedupeKey;
      if (monthlyDedupeKey) {
        if (await ensureMonthlyDedupeKey(ctx.storage, monthlyDedupeKey)) {
          ctx.req.log.debug(`Found a fresh job with "${monthlyDedupeKey}" monthly key, skipping.`);
          return;
        }
      }

      try {
        await addJob(ctx.runner, taskName, input.payload as any, input.spec);
      } catch (error) {
        if (monthlyDedupeKey) {
          await rollbackMonthlyDedupeKey(ctx.storage, monthlyDedupeKey);
        }

        throw error;
      }
    });
}
