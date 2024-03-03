import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';
import { Docker } from './docker';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type SchemaPolicy = ReturnType<typeof deploySchemaPolicy>;

export function deploySchemaPolicy({
  deploymentEnv,
  release,
  image,
  docker,
}: {
  image: string;
  release: string;
  deploymentEnv: DeploymentEnvironment;
  docker: Docker;
}) {
  return new ServiceDeployment('schema-policy-service', {
    image,
    imagePullSecret: docker.secret,
    env: {
      ...deploymentEnv,
      ...commonEnv,
      SENTRY: commonEnv.SENTRY_ENABLED,
      RELEASE: release,
    },
    readinessProbe: '/_readiness',
    livenessProbe: '/_health',
    startupProbe: '/_health',
    exposesMetrics: true,
    replicas: isProduction(deploymentEnv) ? 3 : 1,
    pdb: true,
  }).deploy();
}
