import * as k8s from '@pulumi/kubernetes';
import * as kx from '@pulumi/kubernetesx';
import * as pulumi from '@pulumi/pulumi';
import { isDefined } from './helpers';
import { normalizeEnv, PodBuilder } from './pod-builder';
import { ServiceSecret } from './secrets';

type ProbeConfig = Omit<
  k8s.types.input.core.v1.Probe,
  'httpGet' | 'exec' | 'grpc' | 'tcpSocket'
> & { endpoint: string };

function normalizeEnvSecrets(envSecrets?: Record<string, ServiceSecretBinding<any>>) {
  return envSecrets
    ? Object.keys(envSecrets).map(name => ({
        name,
        valueFrom: {
          secretKeyRef: {
            name: envSecrets[name].secret.record.metadata.name,
            key: envSecrets[name].key,
          },
        },
      }))
    : [];
}

export type ServiceSecretBinding<T extends Record<string, string>> = {
  secret: ServiceSecret<T>;
  key: keyof T | pulumi.Output<keyof T>;
};

export class ServiceDeployment {
  private envSecrets: Record<string, ServiceSecretBinding<any>> = {};

  constructor(
    protected name: string,
    protected options: {
      imagePullSecret?: k8s.core.v1.Secret;
      env?: kx.types.Container['env'];
      args?: kx.types.Container['args'];
      image: string;
      port?: number;
      serviceAccountName?: pulumi.Output<string>;
      livenessProbe?: string | ProbeConfig;
      readinessProbe?: string | ProbeConfig;
      startupProbe?: string | ProbeConfig;
      memoryLimit?: string;
      cpuLimit?: string;
      volumes?: k8s.types.input.core.v1.Volume[];
      volumeMounts?: k8s.types.input.core.v1.VolumeMount[];
      /**
       * Enables /metrics endpoint on port 10254
       */
      exposesMetrics?: boolean;
      replicas?: number;
      pdb?: boolean;
      autoScaling?: {
        minReplicas?: number;
        maxReplicas: number;
        cpu: {
          limit: string;
          cpuAverageToScale: number;
        };
      };
      availabilityOnEveryNode?: boolean;
      command?: string[];
    },
    protected dependencies?: Array<pulumi.Resource | undefined | null>,
    protected parent?: pulumi.Resource | null,
  ) {}

  withSecret<T extends Record<string, string | pulumi.Output<string>>>(
    envVar: string,
    secret: ServiceSecret<T>,
    key: keyof T,
  ) {
    this.envSecrets[envVar] = { secret, key };

    return this;
  }

  withConditionalSecret<T extends Record<string, string | pulumi.Output<string>>>(
    enabled: boolean,
    envVar: string,
    secret: ServiceSecret<T> | null,
    key: keyof T,
  ) {
    if (enabled && secret) {
      this.envSecrets[envVar] = { secret, key };
    }

    return this;
  }

  deployAsJob() {
    const { pb } = this.createPod(true);

    const job = new kx.Job(
      this.name,
      {
        spec: pb.asJobSpec(),
      },
      { dependsOn: this.dependencies?.filter(isDefined) },
    );

    return { job };
  }

  createPod(asJob: boolean) {
    const port = this.options.port || 3000;
    const additionalEnv: any[] = normalizeEnv(this.options.env);
    const secretsEnv: any[] = normalizeEnvSecrets(this.envSecrets);

    let startupProbe: k8s.types.input.core.v1.Probe | undefined = undefined;
    let livenessProbe: k8s.types.input.core.v1.Probe | undefined = undefined;
    let readinessProbe: k8s.types.input.core.v1.Probe | undefined = undefined;

    if (this.options.livenessProbe) {
      livenessProbe =
        typeof this.options.livenessProbe === 'string'
          ? {
              initialDelaySeconds: 10,
              terminationGracePeriodSeconds: 60,
              periodSeconds: 10,
              failureThreshold: 5,
              timeoutSeconds: 5,
              httpGet: {
                path: this.options.livenessProbe,
                port,
              },
            }
          : {
              ...this.options.livenessProbe,
              httpGet: {
                path: this.options.livenessProbe.endpoint,
                port,
              },
            };
    }

    if (this.options.readinessProbe) {
      readinessProbe =
        typeof this.options.readinessProbe === 'string'
          ? {
              initialDelaySeconds: 20,
              periodSeconds: 15,
              failureThreshold: 5,
              timeoutSeconds: 5,
              httpGet: {
                path: this.options.readinessProbe,
                port,
              },
            }
          : {
              ...this.options.readinessProbe,
              httpGet: {
                path: this.options.readinessProbe.endpoint,
                port,
              },
            };
    }

    if (this.options.startupProbe) {
      startupProbe =
        typeof this.options.startupProbe === 'string'
          ? {
              initialDelaySeconds: 20,
              periodSeconds: 30,
              failureThreshold: 10,
              timeoutSeconds: 10,
              httpGet: {
                path: this.options.startupProbe,
                port,
              },
            }
          : {
              ...this.options.startupProbe,
              httpGet: {
                path: this.options.startupProbe.endpoint,
                port,
              },
            };
    }

    if (this.options.exposesMetrics) {
      additionalEnv.push({ name: 'PROMETHEUS_METRICS', value: '1' });
    }

    const topologySpreadConstraints: k8s.types.input.core.v1.TopologySpreadConstraint[] = [];

    if (this.options.availabilityOnEveryNode) {
      // This will ensure that services that has >1 replicas will be scheduled on every available node
      // and ensure that we are not exposed to downtime issues caused by node failures/restarts:
      topologySpreadConstraints.push({
        maxSkew: 1,
        topologyKey: 'topology.kubernetes.io/zone',
        whenUnsatisfiable: 'DoNotSchedule',
        labelSelector: {
          matchLabels: {
            app: this.name,
          },
        },
      });
    }

    const pb = new PodBuilder({
      restartPolicy: asJob ? 'Never' : 'Always',
      imagePullSecrets: this.options.imagePullSecret
        ? [{ name: this.options.imagePullSecret.metadata.name }]
        : undefined,
      terminationGracePeriodSeconds: 60,
      volumes: this.options.volumes,
      topologySpreadConstraints,
      serviceAccountName: this.options.serviceAccountName,
      containers: [
        {
          livenessProbe,
          readinessProbe,
          startupProbe,
          volumeMounts: this.options.volumeMounts,
          imagePullPolicy: 'Always',
          env: [
            { name: 'PORT', value: String(port) },
            {
              name: 'POD_NAME',
              valueFrom: {
                fieldRef: {
                  fieldPath: 'metadata.name',
                },
              },
            },
          ]
            .concat(additionalEnv)
            .concat(secretsEnv),
          name: this.name,
          image: this.options.image,
          resources: this.options?.autoScaling?.cpu.limit
            ? {
                limits: {
                  cpu: this.options?.autoScaling?.cpu.limit,
                },
              }
            : undefined,
          args: this.options.args,
          ports: {
            http: port,
            ...(this.options.exposesMetrics
              ? {
                  metrics: 10_254,
                }
              : {}),
          },
          command: this.options.command,
        },
      ],
    });

    return { pb };
  }

  deploy() {
    const { pb } = this.createPod(false);

    const metadata: k8s.types.input.meta.v1.ObjectMeta = {
      annotations: {},
    };

    metadata.labels = {
      app: this.name,
    };

    if (this.options.exposesMetrics) {
      metadata.annotations = {
        'prometheus.io/port': '10254',
        'prometheus.io/path': '/metrics',
        'prometheus.io/scrape': 'true',
      };
    }

    const deployment = new kx.Deployment(
      this.name,
      {
        spec: pb.asExtendedDeploymentSpec(
          {
            replicas: this.options.replicas ?? 1,
            strategy: {
              type: 'RollingUpdate',
              rollingUpdate: {
                maxSurge: this.options.replicas ?? 1,
                maxUnavailable: 0,
              },
            },
          },
          {
            annotations: metadata.annotations,
            labels: metadata.labels,
          },
        ),
      },
      {
        dependsOn: this.dependencies?.filter(isDefined),
        parent: this.parent ?? undefined,
      },
    );

    if (this.options.pdb) {
      new k8s.policy.v1.PodDisruptionBudget(`${this.name}-pdb`, {
        spec: {
          minAvailable: 1,
          selector: deployment.spec.selector,
        },
      });
    }

    const service = deployment.createService({});

    if (this.options.autoScaling) {
      new k8s.autoscaling.v2.HorizontalPodAutoscaler(
        `${this.name}-autoscaler`,
        {
          apiVersion: 'autoscaling/v2',
          kind: 'HorizontalPodAutoscaler',
          metadata: {},
          spec: {
            scaleTargetRef: {
              name: deployment.metadata.name,
              kind: deployment.kind,
              apiVersion: deployment.apiVersion,
            },
            metrics: [
              {
                type: 'Resource',
                resource: {
                  name: 'cpu',
                  target: {
                    type: 'Utilization',
                    averageUtilization: this.options.autoScaling.cpu.cpuAverageToScale,
                  },
                },
              },
            ],
            minReplicas: this.options.autoScaling.minReplicas || this.options.replicas || 1,
            maxReplicas: this.options.autoScaling.maxReplicas,
          },
        },
        {
          dependsOn: [deployment, service],
        },
      );
    }

    return { deployment, service };
  }
}
