import type { FastifyLoggerInstance } from '@hive/service-common';
import { compress } from '@hive/usage-common';
import type { ClickHouseClient } from '@clickhouse/client';
import pRetry from 'p-retry';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

export type Fallback = ReturnType<typeof createFallback>;

function retry(run: () => Promise<unknown>) {
  return pRetry(run, {
    retries: 1,
  });
}

export interface S3Config {
  region: string;
  bucket: string;
  apiVersion: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Writes usage data to S3 in case of ClickHouse failure.
 *
 * Adds gzipped files to S3 bucket.
 * Prefixes files with the name of the table.
 *
 * Example insert statement:
 * INSERT INTO default.operations SELECT * FROM
 *  s3('https://BUCKET.s3.REGION.amazonaws.com/operations_*.gz', 'CSVWithNames')
 */
export function createFallback(config: {
  s3: S3Config;
  clickhouse: ClickHouseClient;
  logger: FastifyLoggerInstance;
  intervalInMS: number;
}) {
  const { s3, logger, clickhouse } = config;

  logger.info('Fallback to S3 is enabled');

  function sync(table: 'operations' | 'operation_collection') {
    let timeoutId: ReturnType<typeof setTimeout>;
    let pendingPromise = Promise.resolve();

    function schedule() {
      timeoutId = setTimeout(
        async () => {
          try {
            pendingPromise = performSync(table).catch(error => {
              console.log(error);
              logger.error(`Failed to perform sync of table %s: `, table, error?.message);
            });
            await pendingPromise;
          } finally {
            schedule();
          }
        },
        // Because we await the Promise returned by performSync, the interval is not exact, it's a bit more.
        // The provided interval is just a minimum time between syncs.
        config.intervalInMS
      );
    }

    schedule();

    async function performSync(table: 'operations' | 'operation_collection') {
      // Check if ClickHouse is available
      await clickhouse.query({
        query: `SELECT 1`,
      });

      const listResult = await client.send(
        new ListObjectsV2Command({
          Bucket: s3.bucket,
          Prefix: `${table}_`,
          MaxKeys: 1,
        })
      );

      if (listResult.Contents?.length) {
        const Key = listResult.Contents[0].Key!;
        await clickhouse.exec({
          query: `INSERT INTO ${table} SELECT * FROM s3('https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${Key}', '${s3.accessKeyId}', '${s3.secretAccessKey}', 'CSVWithNames')`,
        });
        logger.info('Inserted %s from S3', Key);
        await client.send(
          new DeleteObjectCommand({
            Bucket: s3.bucket,
            Key,
          })
        );
      }
    }

    return {
      async stop() {
        logger.info('Stopping S3 sync for table %s', table);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        await pendingPromise;
        await performSync(table);
        logger.info('Stopped S3 sync for table %s', table);
      },
    };
  }

  const client = new S3Client({
    region: s3.region,
    apiVersion: s3.apiVersion,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
  });
  return {
    /**
     * INSERTs in ClickHouse are idempotent.
     *
     * We can retry the same INSERT statement multiple times.
     * We can't allow the ingestor to have more than a single replica
     * and still safely write data from S3 to ClickHouse.
     * The reason for it is that those insert statement could run one after another because or race conditions
     * and data would be duplicated.
     *
     * From the documentation: https://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replication/
     * """
     *  Data blocks are deduplicated.
     *  For multiple writes of the same data block (data blocks of the same size containing the same rows in the same order),
     *  the block is only written once.
     *  The reason for this is in case of network failures when the client application does not know if the data was written to the DB,
     *  so the INSERT query can simply be repeated.
     *  It does not matter which replica INSERTs were sent to with identical data.
     *  INSERTs are idempotent.
     *  Deduplication parameters are controlled by merge_tree server settings.
     * """
     */
    sync() {
      const operationsSync = sync('operations');
      const operationCollectionSync = sync('operation_collection');

      return {
        async stop() {
          await Promise.all([operationsSync.stop(), operationCollectionSync.stop()]);
          client.destroy();
        },
      };
    },
    async write(buffer: Buffer, table: 'operations' | 'operation_collection') {
      try {
        const Body = await compress(buffer);
        const ChecksumSHA256 = createHash('sha256').update(Body).digest('base64');
        await retry(() =>
          client.send(
            new PutObjectCommand({
              Bucket: s3.bucket,
              Key: `${table}_${new Date().toISOString()}-${Math.random().toString(16).substring(2)}.gz`,
              Body,
              ChecksumSHA256,
            })
          )
        );
      } catch (error) {
        logger.error('Failed to write %s to S3: %s', table, error);
      }
    },
  };
}
