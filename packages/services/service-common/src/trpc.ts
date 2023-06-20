import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import type { AnyRouter } from '@trpc/server';
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

export async function handleTRPCError<
  TNextResult extends
    | {
        ok: false;
        error: {
          message: string;
          cause?: Error | undefined;
        };
      }
    | {
        ok: true;
      },
  T extends {
    next(): Promise<TNextResult>;
    ctx: {
      req: FastifyRequest;
    };
    path: string;
  },
>({ next, ctx, path }: T): Promise<TNextResult> {
  const result = await next();

  if (!result.ok) {
    // Ignore validation errors
    if (!(result.error.cause instanceof ZodError)) {
      Sentry.captureException(result.error, {
        tags: {
          path,
          request_id: ctx.req.id,
        },
      });
    }
    ctx.req.log.error(result.error.message);
  }

  return result;
}
