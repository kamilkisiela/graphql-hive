import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Emails } from './emails';
import { Postgres } from './postgres';
import { UsageEstimator } from './usage-estimation';

export type RateLimitService = ReturnType<typeof deployRateLimit>;

export function deployRateLimit({
  deploymentEnv,
  dbMigrations,
  usageEstimator,
  emails,
  release,
  image,
  docker,
  postgres,
}: {
  usageEstimator: UsageEstimator;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  emails: Emails;
  release: string;
  image: string;
  docker: Docker;
  postgres: Postgres;
}) {
  const rateLimitConfig = new pulumi.Config('rateLimit');
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

  return new ServiceDeployment(
    'rate-limiter',
    {
      imagePullSecret: docker.secret,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        LIMIT_CACHE_UPDATE_INTERVAL_MS: rateLimitConfig.require('updateIntervalMs'),
        RELEASE: release,
        USAGE_ESTIMATOR_ENDPOINT: serviceLocalEndpoint(usageEstimator.service),
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
        WEB_APP_URL: `https://${deploymentEnv.DEPLOYED_DNS}/`,
      },
      exposesMetrics: true,
      port: 4000,
      image,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  )
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    .deploy();
}
