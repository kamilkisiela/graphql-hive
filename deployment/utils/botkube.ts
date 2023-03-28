import * as k8s from '@pulumi/kubernetes';
import { Output } from '@pulumi/pulumi';
import { helmChart } from './helm';

export class BotKube {
  deploy(config: {
    slackChannelName: string;
    slackBotToken: Output<string>;
    slackAppToken: Output<string>;
    clusterName: string;
    enableKubectl: boolean;
  }) {
    const ns = new k8s.core.v1.Namespace('botkube', {
      metadata: {
        name: 'botkube',
      },
    });

    new k8s.helm.v3.Chart(
      'botkube',
      {
        // prettier-ignore
        ...helmChart('https://charts.botkube.io', 'botkube', '0.18.0'),
        namespace: ns.metadata.name,
        values: {
          settings: {
            clusterName: config.clusterName,
          },
          actions: {
            'show-logs-on-error': {
              enabled: true,
            },
          },
          executors: {
            'kubectl-all-ns': {
              kubectl: {
                enabled: true,
                namespaces: {
                  include: ['.*'],
                },
                restrictAccess: false,
                defaultNamespace: 'default',
                commands: {
                  verbs: ['cluster-info', 'diff', 'explain', 'get', 'logs', 'top'],
                  resources: [
                    'deployments',
                    'pods',
                    'services',
                    'namespaces',
                    'daemonsets',
                    'statefulsets',
                    'storageclasses',
                    'nodes',
                    'configmaps',
                  ],
                },
              },
            },
            helm: {
              'botkube/helm': {
                enabled: false,
              },
            },
          },
          communications: {
            'default-group': {
              socketSlack: {
                enabled: true,
                botToken: config.slackBotToken,
                appToken: config.slackAppToken,
                channels: {
                  default: {
                    name: config.slackChannelName,
                    notification: {
                      disabled: false,
                    },
                    bindings: {
                      executors: ['kubectl-all-ns'],
                      sources: ['k8s-err-with-logs-events', 'k8s-err-events'],
                      actions: ['show-logs-on-error'],
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        dependsOn: [ns],
      },
    );
  }
}
