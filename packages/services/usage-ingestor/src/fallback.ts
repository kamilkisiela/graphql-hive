import type { FastifyLoggerInstance } from '@hive/service-common';
import { compress } from '@hive/usage-common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

export type Fallback = ReturnType<typeof createFallback>;

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
 *  s3('https://ORG.s3.REGION.amazonaws.com/BUCKET/operations_*.gz', 'CSVWithNames')
 */
export function createFallback(config: { s3: S3Config; logger: FastifyLoggerInstance }) {
  const { s3, logger } = config;

  logger.info('Fallback to S3 is enabled');

  const client = new S3Client({
    region: s3.region, // 'us-east-1',
    apiVersion: s3.apiVersion, // '2006-03-01',
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
  });

  return {
    async write(buffer: Buffer, table: string) {
      try {
        const Body = await compress(buffer);
        const ChecksumSHA256 = createHash('sha256').update(Body).digest('base64');
        await client.send(
          new PutObjectCommand({
            Bucket: s3.bucket, // `graphql-hive-usage-ingestor`,
            Key: `${table}_${new Date().toISOString()}-${Math.random().toString(16).substring(2)}.gz`,
            Body,
            ChecksumSHA256,
          })
        );
      } catch (error) {
        logger.error('Failed to write %s to S3: %s', table, error);
      }
    },
  };
}
