import { ServiceDeployment } from '../utils/service-deployment';
import * as k8s from '@pulumi/kubernetes';

export type Docs = ReturnType<typeof deployDocs>;

export function deployDocs({
  release,
  image,
  rootDns,
  imagePullSecret,
}: {
  release: string;
  image: string;
  rootDns: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const deployment = new ServiceDeployment('docs', {
    image,
    imagePullSecret,
    readinessProbe: '/api/health',
    livenessProbe: '/api/health',
    env: [
      { name: 'RELEASE', value: release },
      { name: 'DEPLOYED_DNS', value: rootDns },
      { name: 'NODE_ENV', value: 'production' },
    ],
    port: 3000,
  }).deploy();

  return {
    ...deployment,
    endpoint: `https://docs.${rootDns}/`,
  };
}
