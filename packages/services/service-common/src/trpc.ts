import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { httpLink, HTTPLinkOptions, OperationLink, TRPCClientError, TRPCLink } from '@trpc/client';
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

    opts.ctx.req.log.error(result.error.stack ?? result.error);
  }

  return result;
});

export function createTimeoutHTTPLink(
  args: HTTPLinkOptions & {
    /** timeout in milliseconds defaults to 50_000 */
    timeout?: number;
  },
): TRPCLink<AnyRouter> {
  const timeout = args.timeout ?? 50_000;
  const createLink = httpLink(args);

  const linkWithCancelation: TRPCLink<AnyRouter> = args => {
    const link = createLink(args);
    const opLink: OperationLink<AnyRouter> = args => {
      const res = link(args);

      return {
        subscribe: observer => {
          const timeoutId = setTimeout(() => {
            observer?.error?.(new TRPCClientError(`Call exceeded timed out of ${timeout}ms.`));
          }, timeout);

          const subscription = res.subscribe({
            next: value => {
              clearTimeout(timeoutId);
              observer?.next?.(value);
            },
            error: error => {
              clearTimeout(timeoutId);
              observer?.error?.(error);
            },
            complete: () => {
              clearTimeout(timeoutId);
              observer?.complete?.();
            },
          });

          return subscription;
        },
        pipe: res.pipe,
      };
    };

    return opLink;
  };

  return linkWithCancelation;
}
