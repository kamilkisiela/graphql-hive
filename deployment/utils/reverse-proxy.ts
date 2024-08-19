import * as k8s from '@pulumi/kubernetes';
import { interpolate, Output } from '@pulumi/pulumi';
import { ContourValues } from './contour.types';
import { helmChart } from './helm';

// prettier-ignore
export const CONTOUR_CHART = helmChart('https://charts.bitnami.com/bitnami', 'contour', '18.2.11');

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
      requestTimeout?: `${number}s` | 'infinity';
      idleTimeout?: `${number}s`;
      retriable?: boolean;
      customRewrite?: string;
      virtualHost?: Output<string>;
      httpsUpstream?: boolean;
      withWwwDomain?: boolean;
      // https://projectcontour.io/docs/1.29/config/rate-limiting/#local-rate-limiting
      rateLimit?: {
        // Max amount of request allowed with the "unit" paramter.
        maxRequests: number;
        unit: 'second' | 'minute' | 'hour';
        // defining the number of requests above the baseline rate that are allowed in a short period of time.
        // This would allow occasional larger bursts of traffic not to be rate limited.
        burst?: number;
        // default 429
        responseStatusCode?: number;
        // headers to add to the response in case of a rate limit
        responseHeadersToAdd?: Record<string, string>;
      };
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
            // https://projectcontour.io/docs/1.29/config/request-routing/#session-affinity
            loadBalancerPolicy: {
              strategy: 'Cookie',
            },
            // https://projectcontour.io/docs/1.29/config/rate-limiting/#local-rate-limiting
            rateLimitPolicy: route.rateLimit
              ? {
                  local: {
                    requests: route.rateLimit.maxRequests,
                    unit: route.rateLimit.unit,
                    responseHeadersToAdd: [
                      {
                        name: 'x-rate-limit-active',
                        value: 'true',
                      },
                      ...(route.rateLimit.responseHeadersToAdd
                        ? Object.entries(route.rateLimit.responseHeadersToAdd).map(
                            ([key, value]) => ({ name: key, value }),
                          )
                        : []),
                    ],
                    responseStatusCode: route.rateLimit.responseStatusCode || 429,
                    burst: route.rateLimit.burst,
                  },
                }
              : undefined,
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
                  ...(route.requestTimeout || route.idleTimeout
                    ? {
                        timeoutPolicy: {
                          ...(route.requestTimeout
                            ? {
                                response: route.requestTimeout,
                              }
                            : {}),
                          ...(route.idleTimeout
                            ? {
                                idle: route.idleTimeout,
                              }
                            : {}),
                        },
                      }
                    : {}),
                  ...(route.retriable
                    ? {
                        retryPolicy: {
                          count: 2,
                          retryOn: ['reset', 'retriable-status-codes'],
                          retriableStatusCodes: [503],
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

  deployProxy(options: {
    envoy: {
      replicas?: number;
      memory?: string;
      cpu?: string;
    };
    tracing?: {
      collectorService: Output<k8s.core.v1.Service>;
    };
  }) {
    const ns = new k8s.core.v1.Namespace('contour', {
      metadata: {
        name: 'contour',
      },
    });

    let tracingExtensionService: k8s.apiextensions.CustomResource | undefined;

    if (options.tracing) {
      tracingExtensionService = new k8s.apiextensions.CustomResource(`httpproxy-tracing`, {
        apiVersion: 'projectcontour.io/v1alpha1',
        kind: 'ExtensionService',
        metadata: {
          name: 'otel-collector',
          namespace: 'observability',
        },
        spec: {
          protocol: 'h2c',
          services: [
            {
              name: options.tracing.collectorService.metadata.name,
              port: 4317,
            },
          ],
        },
      });
    }

    const chartValues: ContourValues = {
      configInline: {
        // https://projectcontour.io/docs/main/configuration/
        'accesslog-format': 'json',
        // https://www.envoyproxy.io/docs/envoy/latest/configuration/observability/access_log/usage
        'json-fields': [
          '@timestamp',
          'bytes_received',
          'bytes_sent',
          'content_length=%REQ(CONTENT-LENGTH)%',
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
        tracing:
          options.tracing && tracingExtensionService
            ? {
                includePodDetail: false,
                extensionService: interpolate`${tracingExtensionService.metadata.namespace}/${tracingExtensionService.metadata.name}`,
                serviceName: 'contour',
                customTags: [],
              }
            : undefined,
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
        resources: {
          limits: {},
        },
      },
      envoy: {
        resources: {
          limits: {},
        },
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
          options?.envoy?.replicas && options.envoy.replicas > 1
            ? {
                enabled: true,
                minReplicas: 1,
                maxReplicas: options.envoy.replicas,
              }
            : {},
      },
    };

    if (options.envoy?.cpu) {
      (chartValues.envoy!.resources!.limits as any).cpu = options.envoy.cpu;
    }

    if (options.envoy?.memory) {
      (chartValues.envoy!.resources!.limits as any).memory = options.envoy.memory;
    }

    const proxyController = new k8s.helm.v3.Chart('contour-proxy', {
      ...CONTOUR_CHART,
      namespace: ns.metadata.name,
      // https://github.com/bitnami/charts/tree/master/bitnami/contour
      values: chartValues,
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
