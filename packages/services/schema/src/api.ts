import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { handleTRPCError } from '@hive/service-common';
import type { inferRouterInputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import type { Cache } from './cache';
import { composeAndValidateCounter } from './metrics';
import { pickOrchestrator } from './orchestrators';

export type { CompositionFailureError, CompositionErrorSource } from './orchestrators';

export interface Context {
  req: FastifyRequest;
  cache: Cache;
  decrypt(value: string): string;
  broker: {
    endpoint: string;
    signature: string;
  } | null;
}

const t = initTRPC.context<Context>().create();

const errorMiddleware = t.middleware(handleTRPCError);
const procedure = t.procedure.use(errorMiddleware);

const EXTERNAL_VALIDATION = z
  .object({
    endpoint: z.string().url().min(1),
    encryptedSecret: z.string().min(1),
  })
  .nullable();

export const schemaBuilderApiRouter = t.router({
  composeAndValidate: procedure
    .input(
      z.union([
        z
          .object({
            type: z.literal('single'),
            schemas: z.array(
              z
                .object({
                  raw: z.string().min(1),
                  source: z.string().min(1),
                })
                .required(),
            ),
            external: EXTERNAL_VALIDATION,
          })
          .required(),
        z
          .object({
            type: z.union([z.literal('federation'), z.literal('stitching')]),
            schemas: z.array(
              z
                .object({
                  raw: z.string().min(1),
                  source: z.string().min(1),
                  url: z.string().nullish(),
                })
                .required(),
            ),
            external: EXTERNAL_VALIDATION,
          })
          .required(),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      composeAndValidateCounter.inc({ type: input.type });
      return await pickOrchestrator(input.type, ctx.cache, ctx.req, ctx.decrypt).composeAndValidate(
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
