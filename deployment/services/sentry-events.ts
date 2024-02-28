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
      image: 'ghcr.io/getsentry/sentry-kubernetes:55429eef4839ecc0267f5acb30e9fcfcca108c30',
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