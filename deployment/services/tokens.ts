import { parse } from 'pg-connection-string';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';

const commonConfig = new pulumi.Config('common');
const apiConfig = new pulumi.Config('api');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Tokens = ReturnType<typeof deployTokens>;

export function deployTokens({
  deploymentEnv,
  dbMigrations,
  heartbeat,
  image,
  release,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
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
      exposesMetrics: true,
      image,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
        POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
        POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
        POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
        POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
        POSTGRES_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
        RELEASE: release,
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
    },
    [dbMigrations],
  ).deploy();
}
