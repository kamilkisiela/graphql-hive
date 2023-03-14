import {
  createRouter,
  FromSchema,
  Response,
  RouterInput,
  RouterOutput,
  useErrorHandling,
} from 'fets';
import { createLogger } from '@graphql-yoga/logger';
import { reportReadiness } from '@hive/service-common';
import * as Sentry from '@sentry/node';
import type { Limiter } from './limiter';

export interface Context {
  limiter: Limiter;
}

const VALIDATION = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
    },
    entityType: {
      type: 'string',
      enum: ['organization', 'target'],
    },
    type: {
      type: 'string',
      enum: ['operations-reporting'],
    },
    token: {
      type: 'string',
      nullable: true,
    },
  },
  additionalProperties: false,
  required: ['id', 'entityType', 'type', 'token'],
} as const;

export type RateLimitInput = FromSchema<typeof VALIDATION>;

export const logger = createLogger();

export type RateLimitApi = typeof rateLimitApiRouter;
export type RateLimitApiInput = RouterInput<RateLimitApi>;
export type RateLimitApiOutput = RouterOutput<RateLimitApi>;

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
    path: '/_health',
    handler: () => new Response(null, { status: 200 }),
  })
  .route({
    path: '/_readiness',
    handler(_req, ctx) {
      const isReady = ctx.limiter.readiness();
      reportReadiness(isReady);
      return new Response(null, {
        status: isReady ? 200 : 400,
      });
    },
  })
  .route({
    operationId: 'getRetention',
    method: 'POST',
    path: '/retention',
    schemas: {
      request: {
        json: {
          type: 'object',
          properties: {
            targetId: {
              type: 'string',
            },
          },
          additionalProperties: false,
          required: ['targetId'],
        },
      },
      responses: {
        200: {
          type: 'number',
        },
        //^ in tRPC, every response is 200 by default. Only if it throws, it's 500 and connection errors or parsing errors are handled by the library through tRPCError class
      },
    } as const,
    async handler(request, ctx) {
      const jsonBody = await request.json();
      //                     ^ does it use runtime validation?
      const retention = ctx.limiter.getRetention(jsonBody.targetId);
      return Response.json(retention, {
        status: 200,
      });
    },
  })
  .route({
    operationId: 'checkRateLimit',
    method: 'POST',
    path: '/check-rate-limit',
    schemas: {
      request: {
        json: VALIDATION,
      },
      responses: {
        200: {
          type: 'object',
          properties: {
            limited: {
              type: 'boolean',
            },
            quota: {
              type: 'number',
            },
            current: {
              type: 'number',
            },
          },
          additionalProperties: false,
          required: ['limited', 'quota', 'current'],
          //        ^ I'm not a fan of creating a list of required fields, it should be next to every property
          //
          //        ^ try to change `current` to `current2` and see what happens. We end up with a typescript error impossible to debug
        } as const,
      },
    },
    async handler(request, ctx) {
      const input = await request.json();
      const result = ctx.limiter.checkLimit(input);
      return Response.json(result, {
        status: 200,
      });
    },
  });
