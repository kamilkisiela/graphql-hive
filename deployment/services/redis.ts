import * as pulumi from '@pulumi/pulumi';
import { serviceLocalHost } from '../utils/local-endpoint';
import { Redis as RedisStore } from '../utils/redis';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';

const redisConfig = new pulumi.Config('redis');

export type Redis = ReturnType<typeof deployRedis>;

export function deployRedis({ deploymentEnv }: { deploymentEnv: DeploymentEnvironment }) {
  const redisPassword = redisConfig.require('password');
  const redisApi = new RedisStore({
    password: redisPassword,
  }).deploy({
    limits: isProduction(deploymentEnv)
      ? {
          memory: '800Mi',
          cpu: '1000m',
        }
      : {
          memory: '80Mi',
          cpu: '50m',
        },
  });

  return {
    deployment: redisApi.deployment,
    service: redisApi.service,
    config: {
      host: serviceLocalHost(redisApi.service),
      port: redisApi.port,
      password: redisPassword,
    },
  };
}
