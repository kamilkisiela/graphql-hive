import * as k8s from '@pulumi/kubernetes';
import { Output } from '@pulumi/pulumi';

export class Proxy {
  private lbService: Output<k8s.core.v1.Service> | null = null;

  constructor(private tlsSecretName: string, private staticIp?: { address?: string }) {}

  registerService(
    dns: { record: string; apex?: boolean },
    routes: {
      name: string;
      path: string;
      service: k8s.core.v1.Service;
      customRewrite?: string;
      virtualHost?: Output<string>;
      httpsUpstream?: boolean;
      withWwwDomain?: boolean;
    }[]
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
                  timeoutPolicy: {
                    response: '60s',
                  },
                }),
          })),
        },
      },
      {
        dependsOn: [cert, this.lbService!],
      }
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
      chart: 'contour',
      version: '10.0.0',
      namespace: ns.metadata.name,
      fetchOpts: {
        repo: 'https://charts.bitnami.com/bitnami',
      },
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
          debug: true,
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
      }
    );

    return this;
  }

  get() {
    return this.lbService;
  }
}
