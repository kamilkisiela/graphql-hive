import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { Docker } from './docker';
import { Redis } from './redis';

const commonConfig = new pulumi.Config('common');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type Emails = ReturnType<typeof deployEmails>;

class PostmarkSecret extends ServiceSecret<{
  token: pulumi.Output<string> | string;
  from: string;
  messageStream: string;
}> {}

export function deployEmails({
  deploymentEnv,
  redis,
  heartbeat,
  release,
  image,
  docker,
}: {
  release: string;
  image: string;
  deploymentEnv: DeploymentEnvironment;
  redis: Redis;
  docker: Docker;
  heartbeat?: string;
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
        ...deploymentEnv,
        ...commonEnv,
        SENTRY: commonEnv.SENTRY_ENABLED,
        RELEASE: release,
        EMAIL_PROVIDER: 'postmark',
        HEARTBEAT_ENDPOINT: heartbeat ?? '',
      },
      readinessProbe: '/_readiness',
      livenessProbe: '/_health',
      startupProbe: '/_health',
      exposesMetrics: true,
      image,
      replicas: isProduction(deploymentEnv) ? 3 : 1,
    },
    [redis.deployment, redis.service],
  )
    .withSecret('REDIS_HOST', redis.secret, 'host')
    .withSecret('REDIS_PORT', redis.secret, 'port')
    .withSecret('REDIS_PASSWORD', redis.secret, 'password')
    .withSecret('EMAIL_FROM', postmarkSecret, 'from')
    .withSecret('EMAIL_PROVIDER_POSTMARK_TOKEN', postmarkSecret, 'token')
    .withSecret('EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM', postmarkSecret, 'messageStream')
    .deploy();

  return { deployment, service, localEndpoint: serviceLocalEndpoint(service) };
}
