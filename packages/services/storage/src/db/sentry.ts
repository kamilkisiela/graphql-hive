import { InterceptorType } from 'slonik';
import { getCurrentHub, captureException } from '@sentry/node';
import type { Span } from '@sentry/types';

export const createSentryInterceptor = (): InterceptorType => {
  const connections: Record<string, Record<string, Span>> = {};

  return {
    afterPoolConnection(context) {
      connections[context.connectionId] = {};

      return null;
    },
    async beforeQueryResult(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const span = connections[context.connectionId][context.queryId];

      if (span) {
        span.finish();
      }

      return null;
    },
    beforePoolConnectionRelease(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      delete connections[context.connectionId];

      return null;
    },
    async beforeQueryExecution(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const scope = getCurrentHub().getScope();
      const parentSpan = scope?.getSpan();
      const span = parentSpan?.startChild({
        description: context.originalQuery.sql,
        op: 'db',
      });

      if (span) {
        connections[context.connectionId][context.queryId] = span;
      }

      return null;
    },
    queryExecutionError(context, _, error) {
      if (!connections[context.connectionId]) {
        return null;
      }

      console.log('Sentry interceptor error', error);
      captureException(error, {
        extra: {
          query: context.originalQuery.sql,
          values: context.originalQuery.values,
        },
      });

      return null;
    },
  };
};
