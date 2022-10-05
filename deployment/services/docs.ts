import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';

export type Docs = ReturnType<typeof deployDocs>;

export function deployDocs({
  rootDns,
  storageContainer,
  packageHelper,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  rootDns: string;
}) {
  const deployment = new RemoteArtifactAsServiceDeployment('docs', {
    storageContainer,
    readinessProbe: '/api/health',
    livenessProbe: '/api/health',
    env: [
      { name: 'RELEASE', value: packageHelper.currentReleaseId() },
      { name: 'DEPLOYED_DNS', value: rootDns },
      { name: 'NODE_ENV', value: 'production' },
    ],
    packageInfo: packageHelper.npmPack('@hive/docs'),
    port: 3000,
  }).deploy();

  return {
    ...deployment,
    endpoint: `https://docs.${rootDns}/`,
  };
}
