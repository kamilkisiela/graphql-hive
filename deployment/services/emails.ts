import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { Docker } from './docker';
import { Environment } from './environment';
import { Redis } from './redis';
import { Sentry } from './sentry';

export type Emails = ReturnType<typeof deployEmails>;

class PostmarkSecret extends ServiceSecret<{
  token: pulumi.Output<string> | string;
  from: string;
  messageStream: string;
}> {}

export function deployEmails({
  environment,
  redis,
  heartbeat,
  image,
  docker,
  sentry,
}: {
  environment: Environment;
  image: string;
  redis: Redis;
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
    'emails-service',
    {
      imagePullSecret: docker.secret,
      env: {
        ...environment.env,
        SENTRY: sentry.enabled ? '1' : '0',
        EMAIL_PROVIDER: 'postmark',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      image,
      replicas: environment.isProduction ? 3 : 1,
    },
    [redis.deployment, redis.service],
  )
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withSecret('EMAIL_FROM', postmarkSecret, 'from')
    .withSecret('EMAIL_PROVIDER_POSTMARK_TOKEN', postmarkSecret, 'token')
    .withSecret('EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM', postmarkSecret, 'messageStream')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
