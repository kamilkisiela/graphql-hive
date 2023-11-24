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

const procedure = t.procedure.use(handleTRPCError);

const EXTERNAL_VALIDATION = z
  .object({
    endpoint: z.string().url().min(1),
    encryptedSecret: z.string().min(1),
  })
  .nullable();

const ContractsInputModel = z.array(
  z.object({
    id: z.string(),
    filter: z.object({
      include: z.array(z.string()).nullable(),
      exclude: z.array(z.string()).nullable(),
    }),
  }),
);

export type ContractsInputType = z.TypeOf<typeof ContractsInputModel>;

export const schemaBuilderApiRouter = t.router({
  composeAndValidate: procedure
    .input(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('single'),
          schemas: z.array(
            z.object({
              raw: z.string().min(1),
              source: z.string().min(1),
            }),
          ),
        }),
        z.object({
          type: z.literal('federation'),
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
          native: z.boolean().optional(),
          contracts: ContractsInputModel.nullable().optional(),
        }),
        z.object({
          type: z.literal('stitching'),
          schemas: z.array(
            z.object({
              raw: z.string().min(1),
              source: z.string().min(1),
              url: z.string().nullish(),
            }),
          ),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      composeAndValidateCounter.inc({ type: input.type });
      return await pickOrchestrator(input.type, ctx.cache, ctx.req, ctx.decrypt).composeAndValidate(
        input.schemas,
        'external' in input && input.external
          ? {
              ...input.external,
              broker: ctx.broker,
            }
          : null,
        'native' in input && input.native ? true : false,
        'contracts' in input && input.contracts ? input.contracts : undefined,
      );
    }),
});

export type SchemaBuilderApi = typeof schemaBuilderApiRouter;
export type SchemaBuilderApiInput = inferRouterInputs<SchemaBuilderApi>;
