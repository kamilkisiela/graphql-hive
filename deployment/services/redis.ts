import * as pulumi from '@pulumi/pulumi';
import { serviceLocalHost } from '../utils/local-endpoint';
import { Redis as RedisStore } from '../utils/redis';
import { ServiceSecret } from '../utils/secrets';
import { Environment } from './environment';

const redisConfig = new pulumi.Config('redis');

export class RedisSecret extends ServiceSecret<{
  password: string | pulumi.Output<string>;
  host: string | pulumi.Output<string>;
  port: string | pulumi.Output<string>;
}> {}

export type Redis = ReturnType<typeof deployRedis>;

export function deployRedis(input: { environment: Environment }) {
  const redisPassword = redisConfig.requireSecret('password');
  const redisApi = new RedisStore({
    password: redisPassword,
  }).deploy({
    limits: input.environment.isProduction
      ? {
          memory: '800Mi',
          cpu: '1000m',
        }
      : {
          memory: '80Mi',
          cpu: '50m',
        },
  });

  const host = serviceLocalHost(redisApi.service);
  const port = String(redisApi.port);
  const secret = new RedisSecret('redis', {
    password: redisConfig.requireSecret('password'),
    host,
    port,
  });

  return {
    deployment: redisApi.deployment,
    service: redisApi.service,
    secret,
  };
}
