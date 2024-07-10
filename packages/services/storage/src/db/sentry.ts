import { Interceptor } from 'slonik';
import { captureException } from '@sentry/node';

export const createSentryInterceptor = (): Interceptor => {
  return {
    queryExecutionError(context, _, error) {
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
