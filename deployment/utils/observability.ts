import * as k8s from '@pulumi/kubernetes';
import { interpolate, Output } from '@pulumi/pulumi';
import { Environment } from '../services/environment';
import { helmChart } from './helm';
import { Values as OpenTelemetryCollectorValues } from './opentelemetry-collector.types';
import { VectorValues } from './vector.types';

const REVERSE_PROXY_METRICS = [
  'envoy_server_live',
  'envoy_server_memory_allocated',
  'envoy_http_downstream_rq_total',
  'envoy_http_downstream_rq_xx',
  'envoy_http_downstream_rq_active',
  'envoy_http_downstream_rq_time_bucket',
  'envoy_http_downstream_rq_time_sum',
  'envoy_http_downstream_rq_time_count',
  'envoy_cluster_membership_healthy',
  'contour_httpproxy_invalid',
] as const;

/**
 * Hubble metrics exposed by the Cilium agents (Advanced Container Networking Services),
 * used to monitor the egress policies (see `services/egress-policy.ts`).
 * DNS metrics are only produced for pods selected by a policy with DNS rules.
 * ACNS exposes them per node only (no source / destination workload, no DNS query names);
 * the per-workload view comes from the egress flow logs in Loki.
 */
const HUBBLE_METRICS = [
  'hubble_drop_total',
  'hubble_dns_queries_total',
  'hubble_dns_responses_total',
] as const;

export type ObservabilityConfig =
  | 'local'
  | {
      loki: {
        endpoint: Output<string> | string;
        username: Output<string> | string;
        password: Output<string>;
      };
      otlpMetrics: {
        endpoint: Output<string> | string;
        username: Output<string> | string;
        password: Output<string>;
      };
      tempo: {
        endpoint: Output<string> | string;
        username: Output<string> | string;
        password: Output<string>;
      };
    };

// prettier-ignore
export const OTLP_COLLECTOR_CHART = helmChart('https://open-telemetry.github.io/opentelemetry-helm-charts', 'opentelemetry-collector', '0.143.1');
// prettier-ignore
export const VECTOR_HELM_CHART = helmChart('https://helm.vector.dev', 'vector', '0.35.0');

export class Observability {
  constructor(
    private environment: Environment,
    private config: ObservabilityConfig,
  ) {}

  deploy() {
    const nsName = 'observability';
    const ns = new k8s.core.v1.Namespace(nsName, {
      metadata: {
        name: nsName,
      },
    });

    const extensions =
      this.config === 'local'
        ? {}
        : {
            'basicauth/grafana_cloud_traces': {
              client_auth: {
                username: this.config.tempo.username,
                password: this.config.tempo.password,
              },
            },
            'basicauth/grafana_cloud_metrics': {
              client_auth: {
                username: this.config.otlpMetrics.username,
                password: this.config.otlpMetrics.password,
              },
            },
          };

    const exporters =
      this.config === 'local'
        ? {}
        : {
            'otlp/grafana_cloud_traces': {
              endpoint: this.config.tempo.endpoint,
              auth: {
                authenticator: 'basicauth/grafana_cloud_traces',
              },
            },
            'otlphttp/grafana_cloud_metrics': {
              endpoint: this.config.otlpMetrics.endpoint,
              auth: { authenticator: 'basicauth/grafana_cloud_metrics' },
            },
          };

    const sinks =
      this.config === 'local'
        ? {
            stdout: {
              type: 'console',
              inputs: ['kubernetes_logs', 'hubble_egress_logs'],
              encoding: { codec: 'json' },
            },
          }
        : {
            grafana_lab: {
              type: 'loki',
              inputs: ['kubernetes_logs', 'envoy_error_logs', 'hubble_egress_logs'],
              endpoint: interpolate`https://${this.config.loki.endpoint}`,
              auth: {
                strategy: 'basic',
                user: this.config.loki.username,
                password: this.config.loki.password,
              },
              // Based on https://vector.dev/docs/reference/configuration/sources/kubernetes_logs/#output-types
              labels: {
                namespace: '{{`{{ kubernetes.pod_namespace }}`}}',
                pod_name: '{{`{{ kubernetes.pod_name }}`}}',
                node: '{{`{{ kubernetes.pod_node_name }}`}}',
                container_name: '{{`{{ kubernetes.container_name }}`}}',
              },
              encoding: {
                codec: 'text',
              },
              out_of_order_action: 'accept',
              remove_timestamp: false,
            },
          };

    // https://github.com/open-telemetry/opentelemetry-helm-charts/blob/main/charts/opentelemetry-collector/values.yaml
    const chartValues: OpenTelemetryCollectorValues = {
      image: {
        repository: 'otel/opentelemetry-collector-contrib',
      },
      mode: 'deployment',
      replicaCount: 1,
      resources: {
        limits: {
          cpu: this.environment.podsConfig.internalObservability.cpuLimit,
          memory: this.environment.podsConfig.internalObservability.memoryLimit,
        },
      },
      podAnnotations: {
        // This is done because open-telemetry collector doesn't always update the deployment
        // when the config file changes. This will force-restart it.
        'pulumi.com/update-timestamp': Date.now().toString(),
      },
      clusterRole: {
        create: true,
        rules: [
          {
            apiGroups: [''],
            resources: [
              'events',
              'namespaces',
              'namespaces/status',
              'nodes',
              'nodes/spec',
              'pods',
              'pods/metrics',
              'nodes/metrics',
              'pods/status',
              'replicationcontrollers',
              'replicationcontrollers/status',
              'resourcequotas',
              'services',
              'endpoints',
            ],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: ['apps'],
            resources: ['daemonsets', 'deployments', 'replicasets', 'statefulsets'],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: ['extensions'],
            resources: ['daemonsets', 'deployments', 'replicasets'],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: ['batch'],
            resources: ['jobs', 'cronjobs'],
            verbs: ['get', 'list', 'watch'],
          },
          {
            apiGroups: ['autoscaling'],
            resources: ['horizontalpodautoscalers'],
            verbs: ['get', 'list', 'watch'],
          },
        ],
      },
      config: {
        exporters: {
          ...exporters,
          debug: {
            verbosity: 'basic',
          },
        },
        extensions: {
          ...extensions,
          health_check: {},
        },
        processors: {
          batch: {},
          memory_limiter: {
            check_interval: '5s',
            limit_mib: 409,
            spike_limit_mib: 128,
          },
          // Filter OpenTelemetry traces that are not needed for debugging.
          tail_sampling: {
            decision_wait: '10s',
            num_traces: 10000,
            policies: [
              {
                name: 'drop-traces',
                type: 'drop',
                drop: {
                  drop_sub_policy: [
                    {
                      name: 'drop-proxy-noise',
                      type: 'ottl_condition',
                      ottl_condition: {
                        error_mode: 'ignore',
                        span: [
                          // Ignore HEAD/OPTIONS
                          'attributes["component"] == "proxy" and (attributes["http.method"] == "HEAD" or attributes["http.method"] == "OPTIONS")',
                          // Ignore health checks
                          'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and (attributes["http.url"] == "/_readiness" or attributes["http.url"] == "/_health" or IsMatch(attributes["http.url"], ".*/_health"))',
                          // Ignore /usage requests (200 or 429)
                          'attributes["component"] == "proxy" and attributes["http.method"] == "POST" and (attributes["http.url"] == "/usage" or IsMatch(attributes["http.url"], "/usage/.*"))',
                          // Ignore metrics scraping
                          'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and attributes["http.url"] == "/metrics"',
                          // Ignore webapp HTTP calls via upstream cluster name
                          'attributes["component"] == "proxy" and (attributes["http.method"] == "POST" or attributes["http.method"] == "GET") and IsMatch(attributes["upstream_cluster.name"], "default_app-.*")',
                          // Hive Tracing is using these endpoints and they don't have any added value for us when monitored
                          'attributes["component"] == "proxy" and attributes["http.method"] == "POST" and attributes["http.url"] == "/otel/v1/traces"',
                        ],
                      },
                    },
                  ],
                },
              },
              {
                name: 'keep-all-others',
                type: 'always_sample',
              },
            ],
          },
          // Remove raw trace information that we don't really need and exposed by default.
          'attributes/trace_filter': {
            actions: [
              'downstream_cluster',
              'podName',
              'podNamespace',
              'zone',
              'upstream_cluster',
              'peer.address',
            ].map(key => ({
              key,
              action: 'delete',
            })),
          },
          // Remove attributes that are not needed for debugging.
          'resource/trace_cleanup': {
            attributes: [
              'host.arch',
              'process.command',
              'process.command_args',
              'process.executable.path',
              'process.executable.name',
              'process.owner',
              'process.pid',
              'process.runtime.description',
              'process.runtime.name',
              'process.runtime.version',
              'telemetry.sdk.language',
              'telemetry.sdk.name',
              'telemetry.sdk.version',
            ].map(key => ({
              key,
              action: 'delete',
            })),
          },
          // Contour spans are not very human-readable by default, so we are transforming them
          // into a format that is easier to understand.
          // First, we modify the span URL to be relative, and remove the hostname and full path,
          // Then, we rename to be "METHOD /path"
          'transform/patch_envoy_spans': {
            error_mode: 'ignore',
            trace_statements: [
              {
                context: 'span',
                statements: [
                  // By defualt, Envoy reports this as full URL, but we only want the path
                  'replace_pattern(attributes["http.url"], "https?://[^/]+(/[^?#]*)", "$$1") where attributes["component"] == "proxy"',
                  // Replace Envoy default span name with a more human-readable one (e.g. "METHOD /path")
                  'set(name, Concat([attributes["http.method"], attributes["http.url"]], " ")) where attributes["component"] == "proxy" and attributes["http.method"] != nil',
                ],
              },
            ],
          },
          // Every hop reports the same x-request-id under a different attribute name
          // (Envoy: guid:x-request-id, Hive Gateway: hive.request.id, Hive services: request.id).
          // Expose a single `request.id` so traces can be searched by one attribute.
          'transform/normalize_request_id': {
            error_mode: 'ignore',
            trace_statements: [
              {
                context: 'span',
                statements: [
                  'set(attributes["request.id"], attributes["guid:x-request-id"]) where attributes["request.id"] == nil and attributes["guid:x-request-id"] != nil',
                  'delete_key(attributes, "guid:x-request-id")',
                  'set(attributes["request.id"], attributes["hive.request.id"]) where attributes["request.id"] == nil and attributes["hive.request.id"] != nil',
                  'delete_key(attributes, "hive.request.id")',
                ],
              },
            ],
          },
        },
        receivers: {
          otlp: {
            protocols: {
              grpc: {},
              http: {},
            },
          },
          prometheus: {
            config: {
              global: {
                evaluation_interval: '10s',
                scrape_interval: '30s',
                scrape_timeout: '10s',
              },
              scrape_configs: [
                {
                  job_name: 'service-metrics',
                  scheme: 'http',
                  honor_labels: true,
                  honor_timestamps: true,
                  metrics_path: '/metrics',
                  kubernetes_sd_configs: [
                    {
                      role: 'pod',
                      namespaces: {
                        names: ['default', 'contour'],
                      },
                    },
                  ],
                  relabel_configs: [
                    // compares the name of the port to == "metrics"
                    {
                      source_labels: ['__meta_kubernetes_pod_container_port_name'],
                      action: 'keep',
                      regex: 'metrics',
                    },
                    // compares "scrape" label to "true"
                    {
                      source_labels: ['__meta_kubernetes_pod_annotation_prometheus_io_scrape'],
                      action: 'keep',
                      regex: true,
                    },
                    {
                      source_labels: ['__meta_kubernetes_pod_name'],
                      action: 'replace',
                      target_label: 'instance',
                      regex: '(.*redis.*)',
                    },
                    {
                      source_labels: ['__meta_kubernetes_pod_annotation_prometheus_io_scheme'],
                      action: 'replace',
                      target_label: '__scheme__',
                      regex: '(https?)',
                    },
                    {
                      source_labels: ['__meta_kubernetes_pod_annotation_prometheus_io_path'],
                      action: 'replace',
                      target_label: '__metrics_path__',
                      regex: '(.+)',
                    },
                    {
                      action: 'labelmap',
                      regex: '__meta_kubernetes_service_label_(.+)',
                    },
                    {
                      action: 'replace',
                      source_labels: ['__meta_kubernetes_namespace'],
                      target_label: 'namespace',
                    },
                    // Contour exports its own namespace label, so keep the scrape namespace separate for filtering.
                    {
                      action: 'replace',
                      source_labels: ['__meta_kubernetes_namespace'],
                      target_label: 'scrape_namespace',
                    },
                    {
                      action: 'replace',
                      source_labels: ['__meta_kubernetes_service_name'],
                      target_label: 'service',
                    },
                    {
                      action: 'replace',
                      source_labels: ['__meta_kubernetes_pod_name'],
                      target_label: 'pod',
                    },
                    {
                      action: 'replace',
                      source_labels: ['__meta_kubernetes_pod_node_name'],
                      target_label: 'kubernetes_node',
                    },
                  ],
                  metric_relabel_configs: [
                    {
                      source_labels: ['scrape_namespace', '__name__'],
                      action: 'keep',
                      regex: `default;.*|contour;(${REVERSE_PROXY_METRICS.join('|')})`,
                    },
                    {
                      action: 'labeldrop',
                      regex: 'scrape_namespace',
                    },
                  ],
                },
                // Clusters without Cilium + ACNS have no matching pods, so the job is a no-op there.
                {
                  job_name: 'hubble-metrics',
                  scheme: 'http',
                  honor_labels: true,
                  kubernetes_sd_configs: [
                    {
                      role: 'pod',
                      namespaces: {
                        names: ['kube-system'],
                      },
                    },
                  ],
                  relabel_configs: [
                    {
                      source_labels: ['__meta_kubernetes_pod_label_k8s_app'],
                      action: 'keep',
                      regex: 'cilium',
                    },
                    // Hubble metrics are served on a dedicated port of the (host network) agent.
                    {
                      source_labels: ['__address__'],
                      action: 'replace',
                      regex: '([^:]+)(?::\\d+)?',
                      replacement: '$$1:9965',
                      target_label: '__address__',
                    },
                    {
                      source_labels: ['__meta_kubernetes_pod_node_name'],
                      action: 'replace',
                      target_label: 'instance',
                    },
                  ],
                  metric_relabel_configs: [
                    {
                      source_labels: ['__name__'],
                      action: 'keep',
                      regex: HUBBLE_METRICS.join('|'),
                    },
                    // IPv6 control packets (router solicitation, neighbor discovery) on IPv4-only
                    // clusters, dropped by Cilium as it has no IPv6 datapath. Harmless noise.
                    {
                      source_labels: ['__name__', 'reason'],
                      action: 'drop',
                      regex: 'hubble_drop_total;UNSUPPORTED_L3_PROTOCOL',
                    },
                    {
                      action: 'labeldrop',
                      regex: 'ips_returned',
                    },
                  ],
                },
              ],
            },
          },
        },
        service: {
          extensions:
            this.config === 'local'
              ? ['health_check']
              : [
                  'health_check',
                  'basicauth/grafana_cloud_traces',
                  'basicauth/grafana_cloud_metrics',
                ],
          pipelines: {
            traces: {
              receivers: ['otlp'],
              processors: [
                'resource/trace_cleanup',
                'attributes/trace_filter',
                'transform/patch_envoy_spans',
                'transform/normalize_request_id',
                'tail_sampling',
                'batch',
              ],
              exporters:
                this.config === 'local' ? ['debug'] : ['debug', 'otlp/grafana_cloud_traces'],
            },
            metrics: {
              exporters:
                this.config === 'local' ? ['debug'] : ['debug', 'otlphttp/grafana_cloud_metrics'],
              processors: ['memory_limiter', 'batch'],
              receivers: ['prometheus'],
            },
          },
        },
      },
    };

    // We are using otel-collector to scrape metrics and collect traces from Pods
    const otlpCollector = new k8s.helm.v3.Chart('metrics', {
      ...OTLP_COLLECTOR_CHART,
      namespace: ns.metadata.name,
      values: chartValues,
    });

    let otlpCollectorService = otlpCollector.getResource(
      'v1/Service',
      `${nsName}/metrics-opentelemetry-collector`,
    );

    // https://vector.dev/docs/reference/configuration/
    const vectorValues: VectorValues = {
      role: 'Agent',
      customConfig: {
        data_dir: '/vector-data-dir',
        api: {
          enabled: true,
          playground: false,
          address: '127.0.0.1:7676',
        },
        sources: {
          kubernetes_logs: {
            type: 'kubernetes_logs',
            extra_field_selector: 'metadata.namespace=default',
          },
          envoy_logs: {
            type: 'kubernetes_logs',
            extra_field_selector: 'metadata.namespace=contour',
          },
          // Egress policy verdicts per connection (see `deployment/services/egress-policy.ts`)
          hubble_egress_logs: {
            type: 'kubernetes_logs',
            extra_field_selector: 'metadata.namespace=kube-system',
            extra_label_selector: 'app=hubble-egress-exporter',
          },
        },
        transforms: {
          envoy_json_logs: {
            type: 'remap',
            inputs: ['envoy_logs'],
            // Avoid sending the event to the sink
            drop_on_error: true,
            // Route the dropped events to the debug_dropped sink
            reroute_dropped: true,
            source: '. |= object!(parse_json!(.message))',
          },
          envoy_error_logs: {
            type: 'filter',
            inputs: ['envoy_json_logs'],
            condition: '.response_code != 200 && .response_code != 401',
          },
        },
        sinks: {
          // enable if you need to debug the raw vector messages
          // stdout: {
          //   type: 'console',
          //   inputs: ['kubernetes_logs'],
          //   encoding: { codec: 'json' },
          // },
          // Debug dropped messages (envoy_json_logs)
          debug_dropped: {
            type: 'console',
            inputs: ['envoy_json_logs.dropped'],
            encoding: { codec: 'json' },
          },
          ...sinks,
        },
      },
    };

    // We are using Vector to scrape logs from the K8s Pods, and send it to Grafana Cloud
    new k8s.helm.v3.Chart(
      'vector-logging',
      {
        // prettier-ignore
        ...VECTOR_HELM_CHART,
        namespace: ns.metadata.name,
        values: vectorValues,
      },
      {
        dependsOn: [ns],
      },
    );

    return {
      otlpCollectorService,
    };
  }
}
