import {
  createRouter,
  Response,
  RouterJsonPostInput,
  RouterJsonPostSuccessOutput,
  useErrorHandling,
} from 'fets';
import { z } from 'zod';
import { createLogger } from '@graphql-yoga/logger';
import * as Sentry from '@sentry/node';
import type { Limiter } from './limiter';

export interface Context {
  limiter: Limiter;
}

export const logger = createLogger();

export type RateLimitInput = z.infer<typeof VALIDATION>;

const VALIDATION = z
  .object({
    id: z.string().min(1),
    entityType: z.enum(['organization', 'target']),
    type: z.enum(['operations-reporting']),
    /**
     * Token is optional, and used only when an additional blocking (WAF) process is needed.
     */
    token: z.string().nullish().optional(),
  })
  .required();

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiInput = RouterJsonPostInput<RateLimitApi>;
export type RateLimitApiOutput = RouterJsonPostSuccessOutput<RateLimitApi>;

export const rateLimitApiRouter = createRouter<Context>({
  title: 'Rate Limit API',
  plugins: [
    // Not sure about here
    useErrorHandling((error, req, ctx) => {
      Sentry.captureException(error, {
        tags: {
          path: req.url,
          request_id: req.headers.get('x-request-id'),
        },
      });
      // Logger is needed here
      ctx.limiter.logger.error(error.message);
      return Response.json(error.message, {
        status: 500,
      });
    }),
  ],
})
  .route({
    method: 'POST',
    path: 'getRetention',
    schemas: {
      request: {
        json: z
          .object({
            targetId: z.string().nonempty(),
          })
          .required(),
      },
    },
    async handler(request, ctx) {
      const jsonBody = await request.json();
      const retention = ctx.limiter.getRetention(jsonBody.targetId);
      return Response.json(retention);
    },
  })
  .route({
    method: 'POST',
    path: 'checkRateLimit',
    schemas: {
      request: {
        json: VALIDATION,
      },
    },
    async handler(request, ctx) {
      const input = await request.json();
      const result = ctx.limiter.checkLimit(input);
      return Response.json(result);
    },
  });
