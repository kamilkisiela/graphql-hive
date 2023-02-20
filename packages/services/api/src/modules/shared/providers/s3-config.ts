import { InjectionToken } from 'graphql-modules';
import type { AwsClient } from '@hive/cdn-script/aws';

export interface S3Config {
  client: AwsClient;
  endpoint: string;
  bucket: string;
}

export const S3_CONFIG = new InjectionToken<S3Config>('S3_CONFIG');
