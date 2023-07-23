import * as k8s from '@pulumi/kubernetes';
import { Output } from '@pulumi/pulumi';
import { helmChart } from './helm';

export class Proxy {
  private lbService: Output<k8s.core.v1.Service> | null = null;

  constructor(
    private tlsSecretName: string,
    private staticIp?: { address?: string; aksReservedIpResourceGroup?: string },
  ) {}

  registerService(
    dns: { record: string; apex?: boolean },
    routes: {
      name: string;
      path: string;
      service: k8s.core.v1.Service;
      timeoutInSeconds?: number;
      retryOnReset?: boolean;
      customRewrite?: string;
      virtualHost?: Output<string>;
      httpsUpstream?: boolean;
      withWwwDomain?: boolean;
    }[],
  ) {
    const cert = new k8s.apiextensions.CustomResource(`cert-${dns.record}`, {
      apiVersion: 'cert-manager.io/v1',
      kind: 'Certificate',
      metadata: {
        name: dns.record,
      },
      spec: {
        commonName: dns.record,
        dnsNames: [dns.record],
        issuerRef: {
          name: this.tlsSecretName,
          kind: 'ClusterIssuer',
        },
        secretName: dns.record,
      },
    });

    new k8s.apiextensions.CustomResource(
      `httpproxy-${dns.record}`,
      {
        apiVersion: 'projectcontour.io/v1',
        kind: 'HTTPProxy',
        metadata: {
          annotations: {
            'ingress.kubernetes.io/force-ssl-redirect': 'true',
          },
          name: `ingress-${dns.record}`,
        },
        spec: {
          virtualhost: {
            fqdn: dns.record,
            tls: {
              secretName: dns.record,
            },
            corsPolicy: {
              allowOrigin: ['https://app.graphql-hive.com', 'https://graphql-hive.com'],
              allowMethods: ['GET', 'POST', 'OPTIONS'],
              allowHeaders: ['*'],
              exposeHeaders: ['*'],
            },
          },
          routes: routes.map(route => ({
            conditions: [
              {
                prefix: route.path,
              },
            ],
            services: [
              {
                name: route.service.metadata.name,
                port: route.service.spec.ports[0].port,
              },
            ],
            ...(route.path === '/'
              ? {}
              : {
                  pathRewritePolicy: {
                    replacePrefix: [
                      {
                        replacement: route.customRewrite || '/',
                      },
                    ],
                  },
                  ...(route.timeoutInSeconds
                    ? {
                        timeoutPolicy: {
                          response: `${route.timeoutInSeconds}s`,
                        },
                      }
                    : {}),
                  ...(route.retryOnReset
                    ? {
                        retryPolicy: {
                          count: 2,
                          retryOn: ['reset'],
                        },
                      }
                    : {}),
                }),
          })),
        },
      },
      {
        dependsOn: [cert, this.lbService!],
      },
    );

    return this;
  }

  deployProxy(options: { replicas?: number }) {
    const ns = new k8s.core.v1.Namespace('contour', {
      metadata: {
        name: 'contour',
      },
    });

    const proxyController = new k8s.helm.v3.Chart('contour-proxy', {
      // prettier-ignore
      ...helmChart('https://charts.bitnami.com/bitnami', 'contour', '12.2.0'),
      namespace: ns.metadata.name,
      // https://github.com/bitnami/charts/tree/master/bitnami/contour
      values: {
        configInline: {
          // https://projectcontour.io/docs/main/configuration/
          'accesslog-format': 'json',
          // https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage
          'json-fields': [
            '@timestamp',
            'bytes_received',
            'bytes_sent',
            'downstream_local_address',
            'duration',
            'method',
            'path',
            'request_id',
            'response_code',
            'response_flags',
            'upstream_cluster',
            'upstream_host',
            'upstream_service_time',
            'user_agent',
            'x_forwarded_for',
          ],
        },
        contour: {
          podAnnotations: {
            'prometheus.io/scrape': 'true',
            'prometheus.io/port': '8000',
            'prometheus.io/scheme': 'http',
            'prometheus.io/path': '/metrics',
          },
          podLabels: {
            'vector.dev/exclude': 'true',
          },
        },
        envoy: {
          service: {
            loadBalancerIP: this.staticIp?.address,
            annotations:
              this.staticIp?.address && this.staticIp?.aksReservedIpResourceGroup
                ? {
                    'service.beta.kubernetes.io/azure-load-balancer-resource-group':
                      this.staticIp?.aksReservedIpResourceGroup,
                  }
                : undefined,
          },
          podAnnotations: {
            'prometheus.io/scrape': 'true',
            'prometheus.io/port': '8002',
            'prometheus.io/scheme': 'http',
            'prometheus.io/path': '/stats/prometheus',
          },
          autoscaling:
            options?.replicas && options?.replicas > 1
              ? {
                  enabled: true,
                  minReplicas: 1,
                  maxReplicas: options.replicas,
                }
              : {},
        },
      },
    });

    this.lbService = proxyController.getResource('v1/Service', 'contour/contour-proxy-envoy');

    const contourDeployment = proxyController.getResource(
      'apps/v1/Deployment',
      'contour/contour-proxy-contour',
    );
    new k8s.policy.v1.PodDisruptionBudget('contour-pdb', {
      spec: {
        minAvailable: 1,
        selector: contourDeployment.spec.selector,
      },
    });

    const envoyDaemonset = proxyController.getResource(
      'apps/v1/ReplicaSet',
      'contour/contour-proxy-envoy',
    );
    new k8s.policy.v1.PodDisruptionBudget('envoy-pdb', {
      spec: {
        minAvailable: 1,
        selector: envoyDaemonset.spec.selector,
      },
    });

    new k8s.apiextensions.CustomResource(
      'secret-delegation',
      {
        apiVersion: 'projectcontour.io/v1',
        kind: 'TLSCertificateDelegation',
        metadata: {
          name: this.tlsSecretName,
          namespace: 'cert-manager',
        },
        spec: {
          delegations: [
            {
              secretName: this.tlsSecretName,
              targetNamespaces: ['*'],
            },
          ],
        },
      },
      {
        dependsOn: [this.lbService],
      },
    );

    return this;
  }

  get() {
    return this.lbService;
  }
}
