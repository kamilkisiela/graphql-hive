import { ServiceDeployment } from '../utils/service-deployment';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { Postgres } from './postgres';
import { Redis } from './redis';
import { Sentry } from './sentry';

export type Tokens = ReturnType<typeof deployTokens>;

export function deployTokens({
  environment,
  dbMigrations,
  heartbeat,
  image,
  docker,
  postgres,
  redis,
  sentry,
}: {
  image: string;
  environment: Environment;
  dbMigrations: DbMigrations;
  heartbeat?: string;
  docker: Docker;
  redis: Redis;
  postgres: Postgres;
  sentry: Sentry;
}) {
  return new ServiceDeployment(
    'tokens-service',
    {
      imagePullSecret: docker.secret,
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      availabilityOnEveryNode: true,
      replicas: environment.isProduction ? 3 : 1,
      image,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
    },
    [dbMigrations],
  )
    .withSecret('POSTGRES_HOST', postgres.secret, 'host')
    .withSecret('POSTGRES_PORT', postgres.secret, 'port')
    .withSecret('POSTGRES_USER', postgres.secret, 'user')
    .withSecret('POSTGRES_PASSWORD', postgres.secret, 'password')
    .withSecret('POSTGRES_DB', postgres.secret, 'database')
    .withSecret('POSTGRES_SSL', postgres.secret, 'ssl')
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
