import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

const ciliumConfig = new pulumi.Config('cilium');

/**
 * Destinations that services calling user-provided URLs must never reach (SSRF):
 * private ranges (VNet, peered networks) and the Azure instance metadata endpoint.
 * CIDR rules don't match in-cluster endpoints, so pod, service and node traffic is unaffected.
 */
const internalCidrs = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.169.254/32'];

type Workload = k8s.apps.v1.Deployment;
type InClusterTarget =
  | k8s.apps.v1.Deployment
  | k8s.core.v1.Service
  | pulumi.Output<k8s.core.v1.Service>;

type ExternalHost = {
  host: pulumi.Input<string>;
  port?: pulumi.Input<number | string>;
};

type PortRule = { port: string; protocol: string };

type WorkloadRules = {
  workload: Workload;
  externalHosts: ExternalHost[];
  inClusterTargets: InClusterTarget[];
  anyExternal: boolean;
};

const defaultPorts: Record<string, number> = { http: 80, https: 443 };

/**
 * Parses a hostname, `host:port`, a URL (with optional credentials) or a `*.` wildcard pattern.
 * Comma-separated values (e.g. Kafka brokers) yield one entry each.
 * The port is the explicit `port`, else the one in the value, else the URL scheme's default.
 */
function parseExternalHost(value: string, port: number | string | undefined) {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(?:[^@/]*@)?([^/:?#]+)(?::(\d+))?/i.exec(part);

      if (!match) {
        // The value isn't printed, as it can contain credentials (e.g. a Sentry DSN).
        throw new Error('Invalid external host passed to the egress policy.');
      }

      const [, scheme, hostname, valuePort] = match;
      const resolvedPort = port ?? valuePort ?? (scheme && defaultPorts[scheme.toLowerCase()]);

      if (!resolvedPort) {
        throw new Error(
          `Missing port for external host "${hostname}". Pass it explicitly, as "host:port" or as an http(s) URL.`,
        );
      }

      return { hostname: hostname.toLowerCase(), port: String(resolvedPort) };
    });
}

function toFQDNSelector(hostname: string) {
  return hostname.startsWith('*.') ? { matchPattern: hostname } : { matchName: hostname };
}

/**
 * One rule per port, as `toPorts` applies to every host of a rule.
 */
function toExternalRules(hosts: { hostname: string; port: string }[]) {
  const hostsByPort = new Map<string, Set<string>>();

  for (const { hostname, port } of hosts) {
    hostsByPort.set(port, (hostsByPort.get(port) ?? new Set()).add(hostname));
  }

  return Array.from(hostsByPort)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([port, hostnames]) => ({
      toFQDNs: Array.from(hostnames).sort().map(toFQDNSelector),
      toPorts: [{ ports: [{ port, protocol: 'TCP' }] }],
    }));
}

function uniquePorts(ports: PortRule[]) {
  return Array.from(new Map(ports.map(port => [`${port.port}/${port.protocol}`, port])).values());
}

function fromServicePorts(ports: k8s.types.output.core.v1.ServicePort[] | undefined) {
  return uniquePorts(
    (ports ?? []).map(port => ({
      port: String(port.targetPort ?? port.port),
      protocol: port.protocol ?? 'TCP',
    })),
  );
}

function withNamespace(
  namespace: pulumi.Input<string | undefined>,
  labels: pulumi.Input<Record<string, string> | undefined>,
) {
  return pulumi.all([namespace, labels]).apply(
    ([namespace, labels]): Record<string, string> => ({
      ...labels,
      'k8s:io.kubernetes.pod.namespace': namespace || 'default',
    }),
  );
}

/**
 * Label selector (including the namespace) of the pods behind an in-cluster target.
 */
function toEndpointSelector(target: InClusterTarget): pulumi.Output<Record<string, string>> {
  if (pulumi.Output.isInstance(target)) {
    return target.apply(service =>
      withNamespace(service.metadata.namespace, service.spec.selector),
    );
  }

  if (target instanceof k8s.core.v1.Service) {
    return withNamespace(target.metadata.namespace, target.spec.selector);
  }

  return withNamespace(target.metadata.namespace, target.spec.selector.matchLabels);
}

/**
 * Ports of the pods behind an in-cluster target (the container / target ports, not the service ports,
 * as policies apply after the service translation).
 */
function toTargetPorts(target: InClusterTarget): pulumi.Output<PortRule[]> {
  if (pulumi.Output.isInstance(target)) {
    return target.apply(service => service.spec.ports.apply(fromServicePorts));
  }

  if (target instanceof k8s.core.v1.Service) {
    return target.spec.ports.apply(fromServicePorts);
  }

  return target.spec.template.spec.containers.apply(containers =>
    uniquePorts(
      containers.flatMap(container =>
        (container.ports ?? []).map(port => ({
          port: String(port.containerPort),
          protocol: port.protocol ?? 'TCP',
        })),
      ),
    ),
  );
}

/**
 * Streams the egress policy verdicts of new connections from the `default` namespace to the internet,
 * from Hubble Relay into the pod logs (JSON, one line per connection). Vector ships them to Loki,
 * where the Egress-Policies dashboard and alert turn them into workload -> host:port views.
 *
 * The Hubble metrics of ACNS have no workload context, and its DNS metrics no query names,
 * so flows are the only source for "which workload talks to which host and port".
 * Hubble attaches the resolved hostname (`destination_names`) to each flow, as the policies
 * send DNS through the Cilium DNS proxy.
 *
 * Runs in `kube-system`, next to the relay's client certificates (rotated by AKS).
 */
function deployEgressFlowExporter() {
  const labels = { app: 'hubble-egress-exporter' };

  return new k8s.apps.v1.Deployment('hubble-egress-exporter', {
    metadata: {
      name: 'hubble-egress-exporter',
      namespace: 'kube-system',
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: 'hubble-egress-exporter',
              image: 'quay.io/cilium/hubble:v1.16.4',
              command: ['/usr/bin/hubble'],
              args: [
                'observe',
                '--server=hubble-relay.kube-system.svc.cluster.local:443',
                '--tls',
                '--tls-server-name=instance.hubble-relay.cilium.io',
                '--tls-ca-cert-files=/certs/ca.crt',
                '--tls-client-cert-file=/certs/tls.crt',
                '--tls-client-key-file=/certs/tls.key',
                '--follow',
                '--output=jsonpb',
                // One policy verdict per new connection (allowed or denied)
                '--type=policy-verdict',
                '--from-namespace=default',
                '--to-label=reserved:world',
              ],
              resources: {
                requests: { cpu: '10m', memory: '32Mi' },
                limits: { cpu: '200m', memory: '128Mi' },
              },
              volumeMounts: [{ name: 'certs', mountPath: '/certs', readOnly: true }],
            },
          ],
          volumes: [
            {
              name: 'certs',
              secret: { secretName: 'hubble-relay-client-certs' },
            },
          ],
        },
      },
    },
  });
}

/**
 * Egress policies per deployment (one `CiliumNetworkPolicy` each), declared by the services.
 *
 * Modes (`cilium:egressPolicies`):
 * - unset: no policies are created.
 * - `observe`: all egress is allowed (by a separate `<deployment>-egress-observe` policy), while
 *   DNS lookups go through the Cilium DNS proxy and the declared rules are rendered as in `enforce`.
 *   The policy verdicts then show whether a connection matches a declaration, or only the
 *   observe-mode allow-all rule and would be blocked once enforced (Egress-Policies dashboard).
 * - `enforce`: egress is limited to the declared rules.
 *
 * Deleting a policy restores the default allow-all behavior for its deployment instantly.
 */
export function initEgressPolicy() {
  const mode = ciliumConfig.get('egressPolicies');

  if (!mode) {
    return null;
  }

  if (mode !== 'observe' && mode !== 'enforce') {
    throw new Error(
      `Unsupported "cilium:egressPolicies" value "${mode}". Expected "observe" or "enforce".`,
    );
  }

  const workloads = new Map<Workload, WorkloadRules>();

  function register(workload: Workload) {
    let rules = workloads.get(workload);

    if (!rules) {
      rules = { workload, externalHosts: [], inClusterTargets: [], anyExternal: false };
      workloads.set(workload, rules);
    }

    return rules;
  }

  // All methods return the manager, so declarations can be chained.
  // Empty hosts / targets (e.g. a disabled integration) are skipped, so they don't break the chain.
  return {
    register(workload: Workload) {
      register(workload);
      return this;
    },
    allowExternal(
      workload: Workload,
      host: pulumi.Input<string> | null | undefined,
      port?: pulumi.Input<number | string>,
    ) {
      const rules = register(workload);
      if (host) {
        rules.externalHosts.push({ host, port });
      }
      return this;
    },
    allowInCluster(from: Workload, to: InClusterTarget | null | undefined) {
      const rules = register(from);
      if (to) {
        rules.inClusterTargets.push(to);
      }
      return this;
    },
    allowAnyExternal(workload: Workload) {
      register(workload).anyExternal = true;
      return this;
    },
    deploy() {
      const policies = Array.from(workloads.values()).map(rules => {
        const name = pulumi.resourceName(rules.workload);

        const egress: pulumi.Input<object[]>[] = [
          [
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
                    // Sends DNS through the proxy, so Hubble can see the resolved FQDNs
                    // and the FQDN rules can learn the IPs behind each host.
                    dns: [{ matchPattern: '*' }],
                  },
                },
              ],
            },
          ],
          pulumi
            .all(rules.externalHosts.map(({ host, port }) => pulumi.all([host, port])))
            .apply(hosts =>
              toExternalRules(hosts.flatMap(([host, port]) => parseExternalHost(host, port))),
            ),
          ...rules.inClusterTargets.map(target =>
            pulumi
              .all([toEndpointSelector(target), toTargetPorts(target)])
              .apply(([selector, ports]) => [
                {
                  toEndpoints: [{ matchLabels: selector }],
                  // Targets without declared ports are allowed on all ports.
                  ...(ports.length ? { toPorts: [{ ports }] } : {}),
                },
              ]),
          ),
        ];

        if (rules.anyExternal) {
          egress.push([{ toEntities: ['world'] }]);
        }

        const namespace = rules.workload.metadata.namespace;
        const endpointSelector = { matchLabels: rules.workload.spec.selector.matchLabels };

        const policy = new k8s.apiextensions.CustomResource(`${name}-egress`, {
          apiVersion: 'cilium.io/v2',
          kind: 'CiliumNetworkPolicy',
          metadata: {
            name: `${name}-egress`,
            namespace,
          },
          spec: {
            endpointSelector,
            // Hostnames and ports aren't secret, even when derived from secret config
            // (e.g. connection strings). Keeps the rules reviewable in `pulumi preview`.
            egress: pulumi.unsecret(pulumi.all(egress).apply(rules => rules.flat())),
            // Deny rules take precedence over any allow rule selecting the same pods.
            ...(rules.anyExternal && mode === 'enforce'
              ? { egressDeny: [{ toCIDRSet: internalCidrs.map(cidr => ({ cidr })) }] }
              : {}),
          },
        });

        if (mode !== 'observe') {
          return [policy];
        }

        // Keeps all egress allowed while observing. `all` is the least specific rule (an allow-all
        // match), and Cilium always reports the most specific matching rule in the policy verdicts
        // (`policy_match_type`). So a connection reported as an allow-all match isn't covered by any
        // declaration, and would be blocked once enforced (Egress-Policies dashboard).
        const observePolicy = new k8s.apiextensions.CustomResource(`${name}-egress-observe`, {
          apiVersion: 'cilium.io/v2',
          kind: 'CiliumNetworkPolicy',
          metadata: {
            name: `${name}-egress-observe`,
            namespace,
          },
          spec: {
            endpointSelector,
            egress: [{ toEntities: ['all'] }],
          },
        });

        return [policy, observePolicy];
      });

      deployEgressFlowExporter();

      return policies.flat();
    },
  };
}

export type EgressPolicyManager = ReturnType<typeof initEgressPolicy>;
