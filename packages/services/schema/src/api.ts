import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { FastifyLoggerInstance } from 'fastify';
import { z } from 'zod';
import { buildCounter, supergraphCounter, validateCounter } from './metrics';
import { pickOrchestrator } from './orchestrators';
import { Redis } from 'ioredis';

const t = initTRPC
  .context<{
    logger: FastifyLoggerInstance;
    redis: Redis;
    decrypt(value: string): string;
    broker: {
      endpoint: string;
      signature: string;
    } | null;
  }>()
  .create();

const TYPE_VALIDATION = z.enum(['single', 'federation', 'stitching']);
const SCHEMA_OBJECT_VALIDATION = {
  raw: z.string().nonempty(),
  source: z.string().nonempty(),
};
const SCHEMAS_VALIDATION = z.array(z.object(SCHEMA_OBJECT_VALIDATION));
const EXTERNAL_VALIDATION = z
  .object({
    endpoint: z.string().url().nonempty(),
    encryptedSecret: z.string().nonempty(),
  })
  .nullable();

export const schemaBuilderApiRouter = t.router({
  supergraph: t.procedure
    .input(
      z
        .object({
          type: TYPE_VALIDATION,
          schemas: z.array(
            z
              .object({
                ...SCHEMA_OBJECT_VALIDATION,
                url: z.string().nullish(),
              })
              .required(),
          ),
          external: EXTERNAL_VALIDATION.optional(),
        })
        .required(),
    )
    .mutation(async ({ ctx, input }) => {
      supergraphCounter
        .labels({
          type: input.type,
        })
        .inc();
      return await pickOrchestrator(input.type, ctx.redis, ctx.logger, ctx.decrypt).supergraph(
        input.schemas,
        input.external
          ? {
              ...input.external,
              broker: ctx.broker,
            }
          : null,
      );
    }),
  validate: t.procedure
    .input(
      z
        .object({
          type: TYPE_VALIDATION,
          schemas: SCHEMAS_VALIDATION,
          external: EXTERNAL_VALIDATION,
        })
        .required(),
    )
    .mutation(async ({ ctx, input }) => {
      validateCounter
        .labels({
          type: input.type,
        })
        .inc();
      return await pickOrchestrator(input.type, ctx.redis, ctx.logger, ctx.decrypt).validate(
        input.schemas,
        input.external
          ? {
              ...input.external,
              broker: ctx.broker,
            }
          : null,
      );
    }),
  build: t.procedure
    .input(
      z
        .object({
          type: TYPE_VALIDATION,
          schemas: SCHEMAS_VALIDATION,
          external: EXTERNAL_VALIDATION,
        })
        .required(),
    )
    .mutation(async ({ ctx, input }) => {
      buildCounter
        .labels({
          type: input.type,
        })
        .inc();
      return await pickOrchestrator(input.type, ctx.redis, ctx.logger, ctx.decrypt).build(
        input.schemas,
        input.external
          ? {
              ...input.external,
              broker: ctx.broker,
            }
          : null,
      );
    }),
});

export type SchemaBuilderApi = typeof schemaBuilderApiRouter;
export type SchemaBuilderApiInput = inferRouterInputs<SchemaBuilderApi>;
