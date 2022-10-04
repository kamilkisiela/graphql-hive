import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { parse } from 'pg-connection-string';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { DeploymentEnvironment } from '../types';
import { PackageHelper } from '../utils/pack';
const commonConfig = new pulumi.Config('common');
const apiConfig = new pulumi.Config('api');

const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Tokens = ReturnType<typeof deployTokens>;

export function deployTokens({
  deploymentEnv,
  dbMigrations,
  storageContainer,
  packageHelper,
  heartbeat,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
  heartbeat?: string;
}) {
  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');
  const connectionString = rawConnectionString.apply(rawConnectionString => parse(rawConnectionString));

  const env: Record<string, string | pulumi.Output<string>> = {
    ...deploymentEnv,
    ...commonEnv,
    SENTRY: commonEnv.SENTRY_ENABLED,
    POSTGRES_HOST: connectionString.apply(connection => connection.host ?? ''),
    POSTGRES_PORT: connectionString.apply(connection => connection.port ?? '5432'),
    POSTGRES_PASSWORD: connectionString.apply(connection => connection.password ?? ''),
    POSTGRES_USER: connectionString.apply(connection => connection.user ?? ''),
    POSTGRES_DB: connectionString.apply(connection => connection.database ?? ''),
    POSTGRES_ENABLE_SSL: connectionString.apply(connection => (connection.ssl ? '1' : '0')),
    RELEASE: packageHelper.currentReleaseId(),
  };

  if (heartbeat) {
    env['heartbeat'] = heartbeat;
  }

  return new RemoteArtifactAsServiceDeployment(
    'tokens-service',
    {
      storageContainer,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/tokens'),
    },
    [dbMigrations]
  ).deploy();
}
