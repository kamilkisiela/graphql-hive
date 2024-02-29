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
    let serviceAccount = new k8s.core.v1.ServiceAccount('sentry-k8s-agent', {
      metadata: {
        name: 'sentry-k8s-agent',
        namespace: 'default',
      },
    });
    let clusterRole = new k8s.rbac.v1.ClusterRole('sentry-k8s-agent-cluster', {
      metadata: {
        name: 'sentry-k8s-agent-cluster',
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['pods', 'events'],
          verbs: ['get', 'list', 'watch'],
        },
      ],
    });

    new k8s.rbac.v1.ClusterRoleBinding('sentry-k8s-agent-cluster', {
      metadata: {
        name: 'sentry-k8s-agent-cluster',
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: clusterRole.metadata.name,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: serviceAccount.metadata.name,
          namespace: serviceAccount.metadata.namespace,
        },
      ],
    });

    return new ServiceDeployment('sentry-events-monitor', {
      image: 'ghcr.io/the-guild-org/sentry-kubernetes:d9f489ced1a8eeff4a08c7e2bce427a1545dbbbd',
      imagePullSecret: config.imagePullSecret,
      serviceAccountName: serviceAccount.metadata.name,
      env: {
        SENTRY_DSN: commonEnv.SENTRY_DSN,
        SENTRY_ENVIRONMENT: config.envName === 'dev' ? 'development' : config.envName,
        SENTRY_K8S_WATCH_NAMESPACES: 'default,observability,contour,cert-manager',
        SENTRY_K8S_MONITOR_CRONJOBS: '0',
      },
    }).deploy();
  } else {
    console.warn('SENTRY_DSN is not set, skipping Sentry events monitor deployment');

    return;
  }
}
