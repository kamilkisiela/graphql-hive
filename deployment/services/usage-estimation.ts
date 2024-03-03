import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Sentry } from './sentry';

export type UsageEstimator = ReturnType<typeof deployUsageEstimation>;

export function deployUsageEstimation({
  image,
  docker,
  release,
  deploymentEnv,
  clickhouse,
  dbMigrations,
  sentry,
}: {
  image: string;
  docker: Docker;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
  sentry: Sentry;
}) {
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

  return new ServiceDeployment(
    'usage-estimator',
    {
      image,
      imagePullSecret: docker.secret,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: sentry.enabled ? '1' : '0',
        RELEASE: release,
      },
      exposesMetrics: true,
      port: 4000,
    },
    [dbMigrations],
  )
    .withSecret('CLICKHOUSE_HOST', clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', clickhouse.secret, 'protocol')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
