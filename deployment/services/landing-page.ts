import * as azure from '@pulumi/azure';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { PackageHelper } from '../utils/pack';

export type LandingPage = ReturnType<typeof deployLandingPage>;

export function deployLandingPage({
  rootDns,
  storageContainer,
  packageHelper,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  rootDns: string;
}) {
  return new RemoteArtifactAsServiceDeployment('landing-page', {
    storageContainer,
    readinessProbe: '/api/health',
    livenessProbe: '/api/health',
    env: [
      { name: 'RELEASE', value: packageHelper.currentReleaseId() },
      { name: 'DEPLOYED_DNS', value: rootDns },
      { name: 'NODE_ENV', value: 'production' },
    ],
    packageInfo: packageHelper.npmPack('@hive/landing-page'),
    port: 3000,
  }).deploy();
}
