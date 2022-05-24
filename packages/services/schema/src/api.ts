import * as trpc from '@trpc/server';
import { inferProcedureInput } from '@trpc/server';
import type { FastifyLoggerInstance } from 'fastify';
import { z } from 'zod';
import { buildCounter, supergraphCounter, validateCounter } from './metrics';
import { pickOrchestrator } from './orchestrators';
import { Redis } from 'ioredis';
import { createErrorHandler } from '@hive/service-common';

const TYPE_VALIDATION = z.enum(['single', 'federation', 'stitching']);
const SCHEMA_OBJECT_VALIDATION = {
  raw: z.string().nonempty(),
  source: z.string().nonempty(),
};
const SCHEMAS_VALIDATION = z.array(z.object(SCHEMA_OBJECT_VALIDATION));

export const schemaBuilderApiRouter = trpc
  .router<{
    logger: FastifyLoggerInstance;
    redis: Redis;
    errorHandler: ReturnType<typeof createErrorHandler>;
  }>()
  .mutation('supergraph', {
    input: z
      .object({
        type: TYPE_VALIDATION,
        schemas: z.array(
          z
            .object({
              ...SCHEMA_OBJECT_VALIDATION,
              url: z.string().nullish(),
            })
            .required()
        ),
      })
      .required(),
    async resolve({ ctx, input }) {
      supergraphCounter
        .labels({
          type: input.type,
        })
        .inc();
      try {
        const orchestrator = pickOrchestrator(input.type, ctx.redis, ctx.logger);

        return await orchestrator.supergraph(input.schemas);
      } catch (error) {
        ctx.errorHandler('Failed to build a supergraph', error as Error, ctx.logger);

        throw error;
      }
    },
  })
  .mutation('validate', {
    input: z
      .object({
        type: TYPE_VALIDATION,
        schemas: SCHEMAS_VALIDATION,
      })
      .required(),
    async resolve({ ctx, input }) {
      validateCounter
        .labels({
          type: input.type,
        })
        .inc();
      try {
        const orchestrator = pickOrchestrator(input.type, ctx.redis, ctx.logger);
        return await orchestrator.validate(input.schemas);
      } catch (error) {
        ctx.errorHandler('Failed to validate a schema', error as Error, ctx.logger);

        throw error;
      }
    },
  })
  .mutation('build', {
    input: z
      .object({
        type: TYPE_VALIDATION,
        schemas: SCHEMAS_VALIDATION,
      })
      .required(),
    async resolve({ ctx, input }) {
      buildCounter
        .labels({
          type: input.type,
        })
        .inc();
      try {
        const orchestrator = pickOrchestrator(input.type, ctx.redis, ctx.logger);

        return await orchestrator.build(input.schemas);
      } catch (error) {
        ctx.errorHandler('Failed to build a schema', error as Error, ctx.logger);

        throw error;
      }
    },
  });

export type SchemaBuilderApi = typeof schemaBuilderApiRouter;
export type SchemaBuilderApiMutate = keyof SchemaBuilderApi['_def']['mutations'];

export type SchemaBuilderMutationInput<TRouteKey extends SchemaBuilderApiMutate> = inferProcedureInput<
  SchemaBuilderApi['_def']['mutations'][TRouteKey]
>;
