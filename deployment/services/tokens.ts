import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
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
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  dbMigrations: DbMigrations;
}) {
  return new RemoteArtifactAsServiceDeployment(
    'tokens-service',
    {
      storageContainer,
      env: {
        ...deploymentEnv,
        ...commonEnv,
        POSTGRES_CONNECTION_STRING: apiConfig.requireSecret('postgresConnectionString'),
        RELEASE: packageHelper.currentReleaseId(),
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      exposesMetrics: true,
      packageInfo: packageHelper.npmPack('@hive/tokens'),
    },
    [dbMigrations]
  ).deploy();
}
