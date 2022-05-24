/// <reference path="../module.d.ts" />
import {
  createPool,
  TaggedTemplateLiteralInvocationType,
  QueryResultRowColumnType,
  CommonQueryMethodsType,
} from 'slonik';
import { createQueryLoggingInterceptor } from 'slonik-interceptor-query-logging';
import { createSentryInterceptor } from './sentry';

const dbInterceptors = [createQueryLoggingInterceptor(), createSentryInterceptor()];

export function getPool(connection: string) {
  const pool = createPool(connection, {
    interceptors: dbInterceptors,
    captureStackTrace: false,
  });

  function interceptError<K extends keyof CommonQueryMethodsType>(methodName: K) {
    const original: CommonQueryMethodsType[K] = pool[methodName];

    function interceptor<T>(
      this: any,
      sql: TaggedTemplateLiteralInvocationType<T>,
      values?: QueryResultRowColumnType[]
    ): any {
      return (original as any).call(this, sql, values).catch((error: any) => {
        error.sql = sql.sql;
        error.values = sql.values || values;

        return Promise.reject(error);
      });
    }

    pool[methodName] = interceptor;
  }

  interceptError('one');
  interceptError('many');

  return pool;
}
