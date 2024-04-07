import { ServiceDeployment } from '../utils/service-deployment';
import { Docker } from './docker';
import { Environment } from './environment';
import { Observability } from './observability';
import { Sentry } from './sentry';

export type SchemaPolicy = ReturnType<typeof deploySchemaPolicy>;

export function deploySchemaPolicy({
  environment,
  image,
  docker,
  sentry,
  observability,
}: {
  observability: Observability;
  image: string;
  environment: Environment;
  docker: Docker;
  sentry: Sentry;
}) {
  return new ServiceDeployment('schema-policy-service', {
    image,
    imagePullSecret: docker.secret,
    env: {
      ...environment.envVars,
      SENTRY: sentry.enabled ? '1' : '0',
      OPENTELEMETRY_COLLECTOR_ENDPOINT:
        observability.enabled && observability.tracingEndpoint ? observability.tracingEndpoint : '',
    },
    readinessProbe: '/_readiness',
    livenessProbe: '/_health',
    startupProbe: '/_health',
    exposesMetrics: true,
    replicas: environment.isProduction ? 3 : 1,
    pdb: true,
  })
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
