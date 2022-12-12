import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { FastifyLoggerInstance } from 'fastify';
import { Redis } from 'ioredis';
import { z } from 'zod';
import { buildCounter, supergraphCounter, validateCounter } from './metrics';
import { pickOrchestrator } from './orchestrators';

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

const COMPOSITE_SCHEMA_OBJECT_VALIDATION = {
  raw: z.string().nonempty(),
  source: z.string().nonempty(),
};
const COMPOSITE_SCHEMAS_VALIDATION = z.array(z.object(COMPOSITE_SCHEMA_OBJECT_VALIDATION));

const SINGLE_SCHEMA_OBJECT_VALIDATION = {
  raw: z.string().nonempty(),
};
const SINGLE_SCHEMA_VALIDATION = z.array(z.object(SINGLE_SCHEMA_OBJECT_VALIDATION));

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
          type: z.literal('federation'),
          schemas: z.array(
            z
              .object({
                raw: z.string().nonempty(),
                source: z.string().nonempty(),
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
      ctx.logger.debug('Supergraph (type=%s)', input.type);
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
      z.union([
        z
          .object({
            type: z.literal('single'),
            schemas: SINGLE_SCHEMA_VALIDATION,
            external: EXTERNAL_VALIDATION,
          })
          .required(),
        z
          .object({
            type: z.union([z.literal('federation'), z.literal('stitching')]),
            schemas: COMPOSITE_SCHEMAS_VALIDATION,
            external: EXTERNAL_VALIDATION,
          })
          .required(),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      validateCounter
        .labels({
          type: input.type,
        })
        .inc();
      ctx.logger.debug('Validation (type=%s)', input.type);
      return await pickOrchestrator(input.type, ctx.redis, ctx.logger, ctx.decrypt).validate(
        input.type === 'single'
          ? input.schemas.map(s => ({
              ...s,
              source: 'single',
            }))
          : input.schemas,
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
      z.union([
        z
          .object({
            type: z.literal('single'),
            schemas: SINGLE_SCHEMA_VALIDATION,
            external: EXTERNAL_VALIDATION,
          })
          .required(),
        z
          .object({
            type: z.union([z.literal('federation'), z.literal('stitching')]),
            schemas: COMPOSITE_SCHEMAS_VALIDATION,
            external: EXTERNAL_VALIDATION,
          })
          .required(),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      buildCounter
        .labels({
          type: input.type,
        })
        .inc();
      ctx.logger.debug('Build (type=%s)', input.type);
      return await pickOrchestrator(input.type, ctx.redis, ctx.logger, ctx.decrypt).build(
        input.type === 'single'
          ? input.schemas.map(s => ({
              ...s,
              source: 'single',
            }))
          : input.schemas,
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
