import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

export class S3Secret extends ServiceSecret<{
  accessKeyId: string | pulumi.Output<string>;
  secretAccessKey: string | pulumi.Output<string>;
  endpoint: string | pulumi.Output<string>;
  bucket: string | pulumi.Output<string>;
}> {}

export function deployS3() {
  const r2Config = new pulumi.Config('r2');

  const secret = new S3Secret('cloudflare-r2', {
    endpoint: r2Config.require('endpoint'),
    bucket: r2Config.require('bucketName'),
    accessKeyId: r2Config.requireSecret('accessKeyId'),
    secretAccessKey: r2Config.requireSecret('secretAccessKey'),
  });

  return { secret };
}

export type S3 = ReturnType<typeof deployS3>;
