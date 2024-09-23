import { InjectionToken } from 'graphql-modules';
import type { AwsClient } from '../../cdn/providers/aws';

export type S3Config = Array<{
  client: AwsClient;
  endpoint: string;
  bucket: string;
}>;

export const S3_CONFIG = new InjectionToken<S3Config>('S3_CONFIG');
