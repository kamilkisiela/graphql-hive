import { createHash } from 'crypto';
import type { FastifyLoggerInstance } from 'fastify';
import { Lru as LruType } from 'tiny-lru';
import { z } from 'zod';
import { createErrorHandler, metrics } from '@hive/service-common';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { initTRPC } from '@trpc/server';
import { useCache } from './cache';

const httpRequests = new metrics.Counter({
  name: 'tokens_http_requests',
  help: 'Number of http requests',
  labelNames: ['path'],
});

const httpRequestDuration = new metrics.Histogram({
  name: 'tokens_http_request_duration_seconds',
  help: 'Duration of an http request',
  labelNames: ['path'],
});

const TARGET_VALIDATION = z
  .object({
    targetId: z.string().nonempty(),
  })
  .required();
const PROJECT_VALIDATION = z
  .object({
    projectId: z.string().nonempty(),
  })
  .required();
const ORG_VALIDATION = z
  .object({
    organizationId: z.string().nonempty(),
  })
  .required();
const TOKEN_VALIDATION = z
  .object({
    token: z.string().nonempty(),
  })
  .required();

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function maskToken(token: string) {
  return token.substring(0, 3) + '•'.repeat(token.length - 6) + token.substring(token.length - 3);
}

function generateToken() {
  const token = createHash('md5')
    .update(String(Math.random()))
    .update(String(Date.now()))
    .digest('hex');

  const hash = hashToken(token);
  const alias = maskToken(token);

  return {
    secret: token,
    hash,
    alias,
  };
}

export type Context = {
  logger: FastifyLoggerInstance;
  errorHandler: ReturnType<typeof createErrorHandler>;
  getStorage: ReturnType<typeof useCache>['getStorage'];
  tokenReadFailuresCache: LruType<
    | {
        type: 'error';
        error: string;
        checkAt: number;
      }
    | {
        type: 'not-found';
        checkAt: number;
      }
  >;
  errorCachingInterval: number;
};

const t = initTRPC.context<Context>().create();

const prometheusMiddleware = t.middleware(async ({ next, path }) => {
  const stopTimer = httpRequestDuration.startTimer({ path });
  httpRequests.inc({ path });
  try {
    return await next();
  } finally {
    stopTimer();
  }
});

const procedure = t.procedure.use(prometheusMiddleware);

export const tokensApiRouter = t.router({
  targetTokens: procedure.input(TARGET_VALIDATION).query(async ({ ctx, input }) => {
    try {
      const storage = await ctx.getStorage();

      return await storage.readTarget(input.targetId);
    } catch (error) {
      ctx.errorHandler('Failed to get tokens of a target', error as Error);

      throw error;
    }
  }),
  invalidateTokenByTarget: procedure.input(TARGET_VALIDATION).mutation(async ({ ctx, input }) => {
    try {
      const storage = await ctx.getStorage();
      storage.invalidateTarget(input.targetId);

      return true;
    } catch (error) {
      ctx.errorHandler('Failed to invalidate tokens of a target', error as Error);

      throw error;
    }
  }),
  invalidateTokenByProject: procedure.input(PROJECT_VALIDATION).mutation(async ({ ctx, input }) => {
    try {
      const storage = await ctx.getStorage();
      storage.invalidateProject(input.projectId);

      return true;
    } catch (error) {
      ctx.errorHandler('Failed to invalidate tokens of a project', error as Error);

      throw error;
    }
  }),
  invalidateTokenByOrganization: procedure
    .input(ORG_VALIDATION)
    .mutation(async ({ ctx, input }) => {
      try {
        const storage = await ctx.getStorage();
        storage.invalidateProject(input.organizationId);

        return true;
      } catch (error) {
        ctx.errorHandler('Failed to invalidate tokens of a org', error as Error);

        throw error;
      }
    }),
  createToken: procedure
    .input(
      z
        .object({
          name: z.string().nonempty(),
          target: z.string().nonempty(),
          project: z.string().nonempty(),
          organization: z.string().nonempty(),
          scopes: z.array(z.string().nonempty()),
        })
        .required(),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { target, project, organization, name, scopes } = input;
        const storage = await ctx.getStorage();
        const token = generateToken();
        const result = await storage.writeToken({
          name,
          target,
          project,
          organization,
          scopes,
          token: token.hash,
          tokenAlias: token.alias,
        });

        return {
          ...result,
          secret: token.secret,
        };
      } catch (error) {
        ctx.errorHandler('Failed to create a token', error as Error);

        throw error;
      }
    }),
  deleteToken: procedure.input(TOKEN_VALIDATION).mutation(async ({ ctx, input }) => {
    try {
      const hashed_token = input.token;
      const storage = await ctx.getStorage();
      await storage.deleteToken(hashed_token);

      return true;
    } catch (error) {
      ctx.errorHandler('Failed to delete a token', error as Error);

      throw error;
    }
  }),
  getToken: procedure.input(TOKEN_VALIDATION).query(async ({ ctx, input }) => {
    const hash = hashToken(input.token);
    const alias = maskToken(input.token);

    // In case the token was not found (or we failed to fetch it)
    const failedRead = ctx.tokenReadFailuresCache.get(hash);

    if (failedRead) {
      // let's re-throw the same error (or return null)
      if (failedRead.checkAt >= Date.now()) {
        if (failedRead.type === 'error') {
          throw new Error(failedRead.error);
        } else {
          return null;
        }
      }
      // or look for it again if last time we checked was 10 minutes ago
    }

    try {
      const storage = await ctx.getStorage();
      const result = await storage.readToken(hash);

      // removes the token from the failures cache (in case the value expired)
      ctx.tokenReadFailuresCache.delete(hash);

      if (!result) {
        // set token read as not found
        // so we don't try to read it again for next X minutes
        ctx.tokenReadFailuresCache.set(hash, {
          type: 'not-found',
          checkAt: Date.now() + ctx.errorCachingInterval,
        });
      }

      return result;
    } catch (error) {
      ctx.errorHandler(`Failed to get a token "${alias}"`, error as Error, ctx.logger);

      // set token read as failure
      // so we don't try to read it again for next X minutes
      ctx.tokenReadFailuresCache.set(hash, {
        type: 'error',
        error: (error as Error).message,
        checkAt: Date.now() + ctx.errorCachingInterval,
      });

      throw error;
    }
  }),
});

export type TokensApi = typeof tokensApiRouter;
export type TokensApiInput = inferRouterInputs<TokensApi>;
export type TokensApiOutput = inferRouterOutputs<TokensApi>;
