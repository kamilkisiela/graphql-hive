import * as kx from '@pulumi/kubernetesx';
import * as k8s from '@pulumi/kubernetes';
import * as azure from '@pulumi/azure';
import * as pulumi from '@pulumi/pulumi';
import { PodBuilder, normalizeEnv } from './pod-builder';
import { PackageInfo } from './pack';
import { isDefined } from './helpers';

const DEFAULT_IMAGE = 'node:16.13.2-alpine3.15';

export class RemoteArtifactAsServiceDeployment {
  constructor(
    protected name: string,
    protected options: {
      storageContainer: azure.storage.Container;
      env?: kx.types.Container['env'];
      packageInfo: PackageInfo;
      port?: number;
      image?: string;
      livenessProbe?: string;
      readinessProbe?: string;
      memoryLimit?: string;
      cpuLimit?: string;
      bin?: string;
      /**
       * Enables /metrics endpoint on port 10254
       */
      exposesMetrics?: boolean;
      replicas?: number;
      autoScaling?: {
        minReplicas?: number;
        maxReplicas: number;
        cpu: {
          limit: string;
          cpuAverageToScale: number;
        };
      };
    },
    protected dependencies?: Array<pulumi.Resource | undefined | null>,
    protected parent?: pulumi.Resource | null
  ) {}

  deployAsJob() {
    const artifactUrl = this.makeArtifactUrl();
    const { pb } = this.createPod(artifactUrl, true);

    const job = new kx.Job(
      this.name,
      {
        spec: pb.asJobSpec(),
      },
      { dependsOn: this.dependencies?.filter(isDefined) }
    );

    return { job };
  }

  createPod(artifactUrl: pulumi.Output<string>, asJob: boolean) {
    const port = this.options.port || 3000;
    const additionalEnv: any[] = normalizeEnv(this.options.env);

    let livenessProbe: k8s.types.input.core.v1.Probe | undefined = undefined;
    let readinessProbe: k8s.types.input.core.v1.Probe | undefined = undefined;

    if (this.options.livenessProbe) {
      livenessProbe = {
        initialDelaySeconds: 3,
        periodSeconds: 20,
        failureThreshold: 10,
        timeoutSeconds: 5,
        httpGet: {
          path: this.options.livenessProbe,
          port,
        },
      };
    }

    if (this.options.readinessProbe) {
      readinessProbe = {
        initialDelaySeconds: 5,
        periodSeconds: 20,
        failureThreshold: 5,
        timeoutSeconds: 5,
        httpGet: {
          path: this.options.readinessProbe,
          port,
        },
      };
    }

    const image = this.options.image || DEFAULT_IMAGE;
    const appVolume = {
      mountPath: '/app',
      name: 'app',
    };

    const volumeMounts = [appVolume];

    if (this.options.exposesMetrics) {
      additionalEnv.push({ name: 'METRICS_ENABLED', value: 'true' }); // TODO: remove this
      additionalEnv.push({ name: 'PROMETHEUS_METRICS', value: '1' });
    }

    const pb = new PodBuilder({
      restartPolicy: asJob ? 'Never' : 'Always',
      volumes: [
        {
          name: appVolume.name,
          emptyDir: {},
        },
      ],
      initContainers: [
        {
          name: `${this.name}-init`,
          image,
          workingDir: appVolume.mountPath,
          volumeMounts,
          command:
            this.options.packageInfo.runtime === 'node'
              ? ['/bin/sh', '-c', artifactUrl.apply(v => `pnpm add ${v}`)]
              : this.options.packageInfo.runtime === 'rust'
              ? ['/bin/sh', '-c', artifactUrl.apply(v => `wget ${v}`)]
              : ['echo missing script!'],
        },
      ],
      containers: [
        {
          livenessProbe,
          readinessProbe,
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
          ].concat(additionalEnv),
          name: this.name,
          image,
          workingDir: appVolume.mountPath,
          volumeMounts: [appVolume],
          resources: this.options?.autoScaling?.cpu.limit
            ? {
                limits: {
                  cpu: this.options?.autoScaling?.cpu.limit,
                },
              }
            : undefined,
          command:
            this.options.packageInfo.runtime === 'node'
              ? ['pnpm', this.options.bin || this.options.packageInfo.bin]
              : this.options.packageInfo.runtime === 'rust'
              ? [this.options.packageInfo.bin]
              : [],
          ports: {
            http: port,
            ...(this.options.exposesMetrics
              ? {
                  metrics: 10254,
                }
              : {}),
          },
        },
      ],
    });

    return { pb };
  }

  private makeArtifactUrl() {
    const azureStaticFile = new azure.storage.Blob(`${this.name}-artifact`, {
      storageAccountName: this.options.storageContainer.storageAccountName,
      storageContainerName: this.options.storageContainer.name,
      type: 'Block',
      source: new pulumi.asset.FileAsset(this.options.packageInfo.file),
    });

    return azureStaticFile.url;
  }

  deploy() {
    const artifactUrl = this.makeArtifactUrl();
    const { pb } = this.createPod(artifactUrl, false);

    const metadata: k8s.types.input.meta.v1.ObjectMeta = {
      annotations: {},
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
          }
        ),
      },
      {
        dependsOn: this.dependencies?.filter(isDefined),
        parent: this.parent ?? undefined,
      }
    );
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
            maxReplicas: this.options.autoScaling.maxReplicas,
            minReplicas: this.options.autoScaling.minReplicas || this.options.replicas || 1,
          },
        },
        {
          dependsOn: [deployment, service],
        }
      );
    }

    return { deployment, service };
  }
}
