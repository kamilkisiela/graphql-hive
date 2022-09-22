import type { ClickHouseClient } from '@clickhouse/client';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { Readable } from 'node:stream';
import { registryFields, operationsFields } from './serializer';
import { writeTime } from './metrics';

export interface ClickHouseConfig {
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
  wait_end_of_query: 0 | 1;
  wait_for_async_insert: 0 | 1;
}

export type Writer = ReturnType<typeof createWriter>;

export function createWriter({
  clickhouse,
  clickhouseCloud,
  logger,
}: {
  clickhouse: ClickHouseClient;
  clickhouseCloud: ClickHouseClient | null;
  logger: FastifyLoggerInstance;
}) {
  return {
    async writeOperations(operations: Buffer[]) {
      operations.unshift(operationsFields, Buffer.from('\n'));
      const buff = Buffer.concat(operations);
      const stopTimer = writeTime.startTimer({ table: 'operations' });
      await Promise.all([
        clickhouse
          .insert({
            table: 'operations',
            values: Readable.from(buff, {
              objectMode: false,
            }),
            format: 'CSVWithNames',
          })
          .finally(() => stopTimer()),
        clickhouseCloud
          ? clickhouseCloud
              .insert({
                table: 'operations',
                values: Readable.from(buff, {
                  objectMode: false,
                }),
                format: 'CSV',
              })
              .catch(error => {
                logger.error('Failed to write operations to ClickHouse Cloud %s', error);
                // Ignore errors from clickhouse cloud
                return Promise.resolve();
              })
          : Promise.resolve(),
      ]);
    },
    async writeRegistry(records: Buffer[]) {
      records.unshift(registryFields, Buffer.from('\n'));
      const buff = Buffer.concat(records);
      const stopTimer = writeTime.startTimer({
        table: 'operation_collection',
      });
      await Promise.all([
        clickhouse
          .insert({
            table: 'operation_collection',
            values: Readable.from(buff, {
              objectMode: false,
            }),
            format: 'CSVWithNames',
          })
          .finally(() => stopTimer()),
        clickhouseCloud
          ? clickhouseCloud
              .insert({
                table: 'operation_collection',
                values: Readable.from(buff, {
                  objectMode: false,
                }),
                format: 'CSV',
              })
              .catch(error => {
                logger.error('Failed to write operation_collection to ClickHouse Cloud %s', error);
                // Ignore errors from clickhouse cloud
                return Promise.resolve();
              })
          : Promise.resolve(),
      ]);
    },
  };
}
