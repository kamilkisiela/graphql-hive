import { parse } from 'pg-connection-string';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Emails } from './emails';
import { UsageEstimator } from './usage-estimation';

const rateLimitConfig = new pulumi.Config('rateLimit');
const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');
const apiConfig = new pulumi.Config('api');

export type RateLimitService = ReturnType<typeof deployRateLimit>;

export function deployRateLimit({
  deploymentEnv,
  dbMigrations,
  usageEstimator,
  emails,
  release,
  image,
  imagePullSecret,
}: {
  usageEstimator: UsageEstimator;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  emails: Emails;
  release: string;
  image: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  return new ServiceDeployment(
    'rate-limiter',
    {
      imagePullSecret,
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
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port || '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        WEB_APP_URL: `https://${deploymentEnv.DEPLOYED_DNS}/`,
      },
      exposesMetrics: true,
      port: 4000,
      image,
    },
    [dbMigrations, usageEstimator.service, usageEstimator.deployment],
  ).deploy();
}
