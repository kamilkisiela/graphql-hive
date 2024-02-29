import { parse } from 'pg-connection-string';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Redis } from './redis';

const commonConfig = new pulumi.Config('common');
const apiConfig = new pulumi.Config('api');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Tokens = ReturnType<typeof deployTokens>;

export function deployTokens({
  deploymentEnv,
  dbMigrations,
  redis,
  heartbeat,
  image,
  release,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  redis: Redis;
  heartbeat?: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString =>
    parse(rawConnectionString),
  );

  return new ServiceDeployment(
    'tokens-service',
    {
      imagePullSecret,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      availabilityOnEveryNode: true,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
      image,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port || '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        REDIS_HOST: redis.config.host,
        REDIS_PORT: String(redis.config.port),
        REDIS_PASSWORD: redis.config.password,
        RELEASE: release,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
    },
    [dbMigrations],
  ).deploy();
}
