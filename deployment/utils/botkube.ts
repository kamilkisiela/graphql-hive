import * as k8s from '@pulumi/kubernetes';
import { Output } from '@pulumi/pulumi';

export class BotKube {
  deploy(config: {
    slackChannelName: string;
    slackToken: Output<string>;
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
        chart: 'botkube',
        version: '0.12.4',
        namespace: ns.metadata.name,
        fetchOpts: {
          repo: 'https://infracloudio.github.io/charts',
        },
        values: {
          communications: {
            slack: {
              enabled: true,
              channel: config.slackChannelName,
              token: config.slackToken,
              notiftype: 'short',
            },
          },
          config: {
            resources: [
              {
                name: 'apps/v1/deployments',
                namespaces: {
                  include: ['default', 'ingress-nginx'],
                },
                events: ['all'],
              },
              {
                name: 'v1/pods',
                namespaces: {
                  include: ['default', 'ingress-nginx'],
                },
                events: ['all'],
              },
            ],
            recommendations: true,
            settings: {
              clustername: config.clusterName,
              kubectl: {
                defaultNamespace: 'default',
                restrictAccess: 'true',
                enabled: String(config.enableKubectl),
                commands: {
                  verbs: ['cluster-info', 'describe', 'get', 'logs', 'top', 'restart'],
                  resources: [
                    'deployments',
                    'pods',
                    'namespaces',
                    'services',
                    'daemonsets',
                    'httpproxy',
                    'statefulsets',
                    'nodes',
                  ],
                },
              },
            },
          },
          image: {
            repository: 'infracloudio/botkube',
            tag: 'v0.12.4',
          },
        },
      },
      {
        dependsOn: [ns],
      }
    );
  }
}
