import * as pulumi from '@pulumi/pulumi';

const clickhouseConfig = new pulumi.Config('clickhouse');

export type Clickhouse = ReturnType<typeof deployClickhouse>;

type ClickhouseConfig = {
  protocol: pulumi.Output<string> | string;
  host: pulumi.Output<string> | string;
  port: pulumi.Output<string> | string;
  username: pulumi.Output<string> | string;
  password: pulumi.Output<string>;
  mirror: Omit<ClickhouseConfig, 'mirror'> | null;
};

function getRemoteClickhouseConfig(): ClickhouseConfig {
  return {
    host: clickhouseConfig.require('host'),
    port: clickhouseConfig.require('port'),
    username: clickhouseConfig.require('username'),
    password: clickhouseConfig.requireSecret('password'),
    protocol: clickhouseConfig.require('protocol'),
    mirror: clickhouseConfig.get('mirrorHost')
      ? {
          host: clickhouseConfig.require('mirrorHost'),
          port: clickhouseConfig.require('mirrorPort'),
          username: clickhouseConfig.require('mirrorUsername'),
          password: clickhouseConfig.requireSecret('mirrorPassword'),
          protocol: clickhouseConfig.require('mirrorProtocol'),
        }
      : null,
  };
}

export function deployClickhouse() {
  return {
    config: getRemoteClickhouseConfig(),
    deployment: null,
    service: null,
  };
}
