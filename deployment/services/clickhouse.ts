import * as pulumi from '@pulumi/pulumi';
import { serviceLocalHost } from '../utils/local-endpoint';
import { Clickhouse as ClickhouseDeployment } from '../utils/clickhouse';

const clickhouseConfig = new pulumi.Config('clickhouse');
const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.getObject<Record<string, string>>('env')!;

export type Clickhouse = ReturnType<typeof deployClickhouse>;

type ClickhouseConfig = {
  protocol: pulumi.Output<string> | string;
  host: pulumi.Output<string> | string;
  port: pulumi.Output<string> | string;
  username: pulumi.Output<string> | string;
  password: pulumi.Output<string>;
  cloud: Omit<ClickhouseConfig, 'cloud'> | null;
};

function getRemoteClickhouseConfig(): ClickhouseConfig {
  return {
    host: clickhouseConfig.require('host'),
    port: clickhouseConfig.require('port'),
    username: clickhouseConfig.require('username'),
    password: clickhouseConfig.requireSecret('password'),
    protocol: clickhouseConfig.require('protocol'),
    cloud: {
      host: clickhouseConfig.require('cloudHost'),
      port: clickhouseConfig.require('cloudPort'),
      username: clickhouseConfig.require('cloudUsername'),
      password: clickhouseConfig.requireSecret('cloudPassword'),
      protocol: clickhouseConfig.require('cloudProtocol'),
    },
  };
}

export function deployClickhouse() {
  if (!clickhouseConfig.getBoolean('inCluster')) {
    return {
      config: getRemoteClickhouseConfig(),
      deployment: null,
      service: null,
    };
  }

  const password = clickhouseConfig.requireSecret('password');
  const username = clickhouseConfig.requireSecret('username');
  const chApi = new ClickhouseDeployment('clickhouse', {
    env: {
      CLICKHOUSE_USER: username,
      CLICKHOUSE_PASSWORD: password,
    },
    sentryDsn: commonEnv.SENTRY_DSN,
  }).deploy();

  const config: ClickhouseConfig = {
    protocol: 'http',
    host: serviceLocalHost(chApi.service),
    port: String(chApi.port),
    password: password,
    username,
    cloud: null,
  };

  return {
    deployment: chApi.deployment,
    service: chApi.service,
    config,
  };
}
