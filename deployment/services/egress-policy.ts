import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

const ciliumConfig = new pulumi.Config('cilium');

/**
 * Cluster-wide egress policy for the workloads in the `default` namespace.
 *
 * Requires Azure CNI powered by Cilium with Advanced Container Networking Services (ACNS) enabled,
 * as the DNS rules depend on the ACNS DNS proxy. Clusters without Cilium don't have the CRD,
 * so the policy is only created when `cilium:egressPolicies` is set for the stack.
 *
 * Modes (`cilium:egressPolicies`):
 * - unset: no policy is created.
 * - `observe`: all egress is allowed, but DNS lookups go through the Cilium DNS proxy,
 *   so Hubble records the FQDNs every workload resolves. Use it to build the allowlist.
 *
 * Removing the policy restores the default allow-all behavior instantly.
 */
export function deployEgressPolicy() {
  const mode = ciliumConfig.get('egressPolicies');

  if (!mode) {
    return null;
  }

  if (mode !== 'observe') {
    throw new Error(`Unsupported "cilium:egressPolicies" value "${mode}". Expected "observe".`);
  }

  return new k8s.apiextensions.CustomResource('egress-policy', {
    apiVersion: 'cilium.io/v2',
    kind: 'CiliumClusterwideNetworkPolicy',
    metadata: {
      name: 'egress-policy',
    },
    spec: {
      endpointSelector: {
        matchExpressions: [
          {
            key: 'k8s:io.kubernetes.pod.namespace',
            operator: 'In',
            values: ['default'],
          },
        ],
      },
      egress: [
        {
          toEndpoints: [
            {
              matchLabels: {
                'k8s:io.kubernetes.pod.namespace': 'kube-system',
                'k8s:k8s-app': 'kube-dns',
              },
            },
          ],
          toPorts: [
            {
              ports: [{ port: '53', protocol: 'ANY' }],
              rules: {
                // Sends DNS through the proxy, so Hubble can see the resolved FQDNs.
                dns: [{ matchPattern: '*' }],
              },
            },
          ],
        },
        {
          // `world` keeps all external egress allowed while observing.
          toEntities: ['cluster', 'kube-apiserver', 'world'],
        },
      ],
    },
  });
}
