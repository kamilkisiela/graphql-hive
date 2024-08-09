import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import type { Broker } from './cf-broker';
import { Docker } from './docker';
import { Environment } from './environment';
import { Observability } from './observability';
import { Sentry } from './sentry';

export type Transmission = ReturnType<typeof deployTransmission>;

class PostmarkSecret extends ServiceSecret<{
  token: pulumi.Output<string> | string;
  from: string;
  messageStream: string;
}> {}

export function deployTransmission({
  environment,
  heartbeat,
  image,
  docker,
  sentry,
  observability,
  broker,
}: {
  observability: Observability;
  environment: Environment;
  image: string;
  broker: Broker;
  docker: Docker;
  heartbeat?: string;
  sentry: Sentry;
}) {
  const emailConfig = new pulumi.Config('email');
  const postmarkSecret = new PostmarkSecret('postmark', {
    token: emailConfig.requireSecret('token'),
    from: emailConfig.require('from'),
    messageStream: emailConfig.require('messageStream'),
  });

  const { deployment, service } = new ServiceDeployment(
    'transmission-service',
    {
      imagePullSecret: docker.secret,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        REQUEST_BROKER: '1',
        EMAIL_PROVIDER: 'postmark',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
        OPENTELEMETRY_COLLECTOR_ENDPOINT:
          observability.enabled && observability.tracingEndpoint
            ? observability.tracingEndpoint
            : '',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      image,
      replicas: environment.isProduction ? 3 : 1,
    },
    [],
  )
    .withSecret('EMAIL_FROM', postmarkSecret, 'from')
    .withSecret('EMAIL_PROVIDER_POSTMARK_TOKEN', postmarkSecret, 'token')
    .withSecret('EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM', postmarkSecret, 'messageStream')
    .withSecret('REQUEST_BROKER_ENDPOINT', broker.secret, 'baseUrl')
    .withSecret('REQUEST_BROKER_SIGNATURE', broker.secret, 'secretSignature')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
