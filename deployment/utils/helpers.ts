import { DeploymentEnvironment } from '../types';

export function isProduction(deploymentEnv: DeploymentEnvironment | string): boolean {
  return isDeploymentEnvironment(deploymentEnv)
    ? deploymentEnv.ENVIRONMENT === 'production'
    : deploymentEnv === 'production' || deploymentEnv === 'prod';
}

export function isDeploymentEnvironment(value: any): value is DeploymentEnvironment {
  return value && typeof value === 'object' && typeof value['ENVIRONMENT'] === 'string';
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
