import * as k8s from '@pulumi/kubernetes';
import { interpolate, Output } from '@pulumi/pulumi';
import { helmChart } from './helm';
import { Values as OpenTelemetryCollectorValues } from './opentelemetry-collector.types';
import { VectorValues } from './vector.types';

export type ObservabilityConfig = {
  loki: {
    endpoint: Output<string> | string;
    username: Output<string> | string;
    password: Output<string>;
  };
  prom: {
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
export const OTLP_COLLECTOR_CHART = helmChart('https://open-telemetry.github.io/opentelemetry-helm-charts', 'opentelemetry-collector', '0.96.0');
// prettier-ignore
export const VECTOR_HELM_CHART = helmChart('https://helm.vector.dev', 'vector', '0.34.0');

export class Observability {
  constructor(
    private envName: string,
    private config: ObservabilityConfig,
  ) {}

  deploy() {
    const nsName = 'observability';
    const ns = new k8s.core.v1.Namespace(nsName, {
      metadata: {
        name: nsName,
      },
    });

    // https://github.com/open-telemetry/opentelemetry-helm-charts/blob/main/charts/opentelemetry-collector/values.yaml
    const chartValues: OpenTelemetryCollectorValues = {
      image: {
        repository: 'otel/opentelemetry-collector-contrib',
      },
      mode: 'deployment',
      replicaCount: 1,
      resources: {
        limits: {
          cpu: '256m',
          memory: '512Mi',
        },
      },
      podAnnotations: {
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
          'otlp/grafana_cloud_traces': {
            endpoint: this.config.tempo.endpoint,
            auth: {
              authenticator: 'basicauth/grafana_cloud_traces',
            },
          },
          logging: {
            verbosity: 'basic',
          },
          prometheusremotewrite: {
            endpoint: interpolate`https://${this.config.prom.username}:${this.config.prom.password}@${this.config.prom.endpoint}`,
          },
        },
        extensions: {
          'basicauth/grafana_cloud_traces': {
            client_auth: {
              username: this.config.tempo.username,
              password: this.config.tempo.password,
            },
          },
          health_check: {},
        },
        processors: {
          batch: {},
          memory_limiter: {
            check_interval: '5s',
            limit_mib: 409,
            spike_limit_mib: 128,
          },
          'filter/traces': {
            error_mode: 'ignore',
            traces: {
              span: [
                'attributes["component"] == "proxy" and attributes["http.method"] == "HEAD"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "OPTIONS"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and IsMatch(attributes["http.url"], ".*/_health") == true',
                'attributes["component"] == "proxy" and attributes["http.method"] == "POST" and attributes["http.url"] == "/usage"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and attributes["http.url"] == "/metrics"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and attributes["http.url"] == "/_readiness"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and attributes["http.url"] == "/_health"',
                'attributes["component"] == "proxy" and attributes["http.method"] == "GET" and IsMatch(attributes["upstream_cluster.name"], "default_app-.*") == true',
              ],
            },
          },
          'attributes/trace_filter': {
            actions: [
              'downstream_cluster',
              'podName',
              'podNamespace',
              'zone',
              'upstream_cluster',
              'peer.address',
              'response_flags',
            ].map(key => ({
              key,
              action: 'delete',
            })),
          },
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
          'transform/patch_envoy_spans': {
            error_mode: 'ignore',
            trace_statements: [
              {
                context: 'span',
                statements: [
                  // By defualt, Envoy reports this as full URL, but we only want the path
                  'replace_pattern(attributes["http.url"], "https?://[^/]+(/[^?#]*)", "$$1") where attributes["component"] == "proxy"',
                  // Replace Envoy default span name with a more human-readable one (e.g. "METHOD /path")
                  'set(name, Concat([attributes["http.method"], attributes["http.url"]], " ")) where attributes["component"] == "proxy"',
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
                  honor_labels: true,
                  honor_timestamps: true,
                  job_name: 'service-metrics',
                  kubernetes_sd_configs: [
                    {
                      role: 'pod',
                      namespaces: {
                        names: ['default'],
                      },
                    },
                  ],
                  metrics_path: '/metrics',
                  relabel_configs: [
                    {
                      source_labels: ['__meta_kubernetes_pod_container_port_name'],
                      action: 'keep',
                      regex: 'metrics',
                    },
                    {
                      source_labels: ['__meta_kubernetes_pod_annotation_prometheus_io_scrape'],
                      action: 'keep',
                      regex: true,
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
                  scheme: 'http',
                },
              ],
            },
          },
        },
        service: {
          extensions: ['health_check', 'basicauth/grafana_cloud_traces'],
          pipelines: {
            traces: {
              receivers: ['otlp'],
              processors: [
                'resource/trace_cleanup',
                'attributes/trace_filter',
                'transform/patch_envoy_spans',
                'filter/traces',
                'batch',
              ],
              exporters: ['logging', 'otlp/grafana_cloud_traces'],
            },
            metrics: {
              exporters: ['logging', 'prometheusremotewrite'],
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
          grafana_lab: {
            type: 'loki',
            inputs: ['kubernetes_logs', 'envoy_error_logs'],
            endpoint: interpolate`https://${this.config.loki.endpoint}`,
            auth: {
              strategy: 'basic',
              user: this.config.loki.username,
              password: this.config.loki.password,
            },
            labels: {
              namespace: '{{`{{ kubernetes.pod_namespace }}`}}',
              container_name: '{{`{{ kubernetes.container_name }}`}}',
              env: this.envName,
            },
            encoding: {
              codec: 'text',
            },
            out_of_order_action: 'accept',
            remove_timestamp: false,
          },
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
