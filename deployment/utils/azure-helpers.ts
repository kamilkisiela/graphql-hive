import * as k8s from '@pulumi/kubernetes';

export function optimizeAzureCluster() {
  /**
   * The following configures the metrics server to use the correct resources limit:
   * https://learn.microsoft.com/en-us/azure/aks/use-metrics-server-vertical-pod-autoscaler
   */
  new k8s.core.v1.ConfigMap('metrics-server-config', {
    metadata: {
      name: 'metrics-server-config',
      namespace: 'kube-system',
      labels: {
        'kubernetes.io/cluster-service': 'true',
        'addonmanager.kubernetes.io/mode': 'EnsureExists',
      },
    },
    data: {
      NannyConfiguration: `
apiVersion: nannyconfig/v1alpha1
kind: NannyConfiguration
baseCPU: 200m
cpuPerNode: 3m
baseMemory: 200Mi
memoryPerNode: 24Mi`,
    },
  });

  /**
   * The following disabled Azure logging. We are not really using it.
   */
  new k8s.core.v1.ConfigMap('optimize-azure-cluster', {
    metadata: {
      name: 'container-azm-ms-agentconfig',
      namespace: 'kube-system',
    },
    data: {
      'schema-version': 'v1',
      'config-version': 'v1',
      'log-data-collection-settings': `
[log_collection_settings]
  [log_collection_settings.stdout]
      enabled = false

  [log_collection_settings.stderr]
      enabled = false

  [log_collection_settings.env_var]
      enabled = false
  [log_collection_settings.enrich_container_logs]
      enabled = false
  [log_collection_settings.collect_all_kube_events]
      enabled = false
`,
    },
  });
}
