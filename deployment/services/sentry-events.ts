import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { ServiceDeployment } from '../utils/service-deployment';

export function deploySentryEventsMonitor(config: {
  envName: string;
  imagePullSecret: k8s.core.v1.Secret;
}) {
  const commonConfig = new pulumi.Config('common');
  const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

  if (commonEnv.SENTRY_DSN) {
    return new ServiceDeployment('sentry-events-monitor', {
      image: 'ghcr.io/the-guild-org/sentry-kubernetes:d9f489ced1a8eeff4a08c7e2bce427a1545dbbbd',
      imagePullSecret: config.imagePullSecret,
      env: {
        SENTRY_DSN: commonEnv.SENTRY_DSN,
        SENTRY_ENVIRONMENT: config.envName,
        SENTRY_K8S_WATCH_NAMESPACES: 'default,observability,contour,cert-manager',
      },
    }).deploy();
  } else {
    console.warn('SENTRY_DSN is not set, skipping Sentry events monitor deployment');

    return;
  }
}
