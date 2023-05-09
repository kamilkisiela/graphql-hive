import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { ServiceDeployment } from '../utils/service-deployment';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type SchemaPolicy = ReturnType<typeof deploySchemaPolicy>;

export function deploySchemaPolicy({
  deploymentEnv,
  release,
  image,
  imagePullSecret,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  return new ServiceDeployment('schema-policy-service', {
    image,
    imagePullSecret,
    env: {
      ...deploymentEnv,
      ...commonEnv,
      SENTRY: commonEnv.SENTRY_ENABLED,
      RELEASE: release,
    },
    readinessProbe: '/_readiness',
    livenessProbe: '/_health',
    exposesMetrics: true,
    replicas: 1,
    pdb: true,
  }).deploy();
}
