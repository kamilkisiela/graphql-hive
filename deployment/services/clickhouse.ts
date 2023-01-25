import * as pulumi from '@pulumi/pulumi';

const clickhouseConfig = new pulumi.Config('clickhouse');

export type Clickhouse = ReturnType<typeof deployClickhouse>;

type ClickhouseConfig = {
  protocol: pulumi.Output<string> | string;
  host: pulumi.Output<string> | string;
  port: pulumi.Output<string> | string;
  username: pulumi.Output<string> | string;
  password: pulumi.Output<string>;
};

function getRemoteClickhouseConfig(): ClickhouseConfig {
  return {
    host: clickhouseConfig.require('host'),
    port: clickhouseConfig.require('port'),
    username: clickhouseConfig.require('username'),
    password: clickhouseConfig.requireSecret('password'),
    protocol: clickhouseConfig.require('protocol'),
  };
}

export function deployClickhouse() {
  return {
    config: getRemoteClickhouseConfig(),
    deployment: null,
    service: null,
  };
}
