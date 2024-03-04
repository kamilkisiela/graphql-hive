import * as k8s from '@pulumi/kubernetes';
import { ServiceDeployment } from '../utils/service-deployment';
import { Docker } from './docker';
import { Environment } from './environment';
import { Sentry } from './sentry';

export function deploySentryEventsMonitor(config: {
  environment: Environment;
  docker: Docker;
  sentry: Sentry;
}) {
  const namepsacesToTrack = ['default', 'observability', 'contour', 'cert-manager'];

  if (config.sentry.enabled && config.sentry.secret) {
    let serviceAccount = new k8s.core.v1.ServiceAccount('sentry-k8s-agent', {
      metadata: {
        name: 'sentry-k8s-agent',
        namespace: 'default',
      },
    });
    const READ_ONLY = ['get', 'list', 'watch'];
    let clusterRole = new k8s.rbac.v1.ClusterRole('sentry-k8s-agent-cluster', {
      metadata: {
        name: 'sentry-k8s-agent-cluster',
      },
      rules: [
        {
          apiGroups: ['batch'],
          resources: ['jobs', 'cronjobs'],
          verbs: READ_ONLY,
        },
        {
          apiGroups: ['extensions', 'apps'],
          resources: ['deployments', 'replicasets'],
          verbs: READ_ONLY,
        },
        {
          apiGroups: [''],
          resources: [
            'pods',
            'events',
            'deployments',
            'replicasets',
            'statefulsets',
            'daemonsets',
            'jobs',
            'cronjobs',
            'namespaces',
          ],
          verbs: READ_ONLY,
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
      imagePullSecret: config.docker.secret,
      serviceAccountName: serviceAccount.metadata.name,
      env: {
        SENTRY_ENVIRONMENT:
          config.environment.envName === 'dev' ? 'development' : config.environment.envName,
        SENTRY_K8S_WATCH_NAMESPACES: namepsacesToTrack.join(','),
      },
    })
      .withSecret('SENTRY_DSN', config.sentry.secret, 'dsn')
      .deploy();
  } else {
    console.warn('SENTRY_DSN is not set, skipping Sentry events monitor deployment');

    return;
  }
}
