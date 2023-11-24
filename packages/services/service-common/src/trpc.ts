import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { experimental_standaloneMiddleware, type AnyRouter } from '@trpc/server';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

export function registerTRPC<TRouter extends AnyRouter, TContext>(
  server: FastifyInstance,
  {
    router,
    createContext,
  }: {
    router: TRouter;
    createContext: (options: CreateFastifyContextOptions) => TContext;
  },
) {
  return server.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router,
      createContext,
    },
  });
}

export const handleTRPCError = experimental_standaloneMiddleware<{
  ctx: {
    req: FastifyRequest;
  };
  input: {};
}>().create(async opts => {
  const result = await opts.next();

  if (!result.ok) {
    // Ignore validation errors
    if (!(result.error.cause instanceof ZodError)) {
      Sentry.captureException(result.error, {
        tags: {
          path: opts.path,
          request_id: opts.ctx.req.id,
        },
      });
    }

    opts.ctx.req.log.error(result.error.message);
  }

  return result;
});
