import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../utils/secrets';

export type Clickhouse = ReturnType<typeof deployClickhouse>;

export class ClickhouseConnectionSecret extends ServiceSecret<{
  host: string | pulumi.Output<string>;
  port: string | pulumi.Output<string>;
  username: string | pulumi.Output<string>;
  password: string | pulumi.Output<string>;
  protocol: string | pulumi.Output<string>;
}> {}

export function deployClickhouse() {
  const clickhouseConfig = new pulumi.Config('clickhouse');
  const secret = new ClickhouseConnectionSecret('clickhouse', {
    host: clickhouseConfig.require('host'),
    port: clickhouseConfig.require('port'),
    username: clickhouseConfig.require('username'),
    password: clickhouseConfig.requireSecret('password'),
    protocol: clickhouseConfig.require('protocol'),
  });

  return {
    secret,
    deployment: null,
    service: null,
  };
}
