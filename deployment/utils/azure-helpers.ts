import * as k8s from '@pulumi/kubernetes';

export function optimizeAzureCluster() {
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
