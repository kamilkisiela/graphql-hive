import * as kx from '@pulumi/kubernetesx';
import * as pulumi from '@pulumi/pulumi';
import { serviceLocalHost } from './local-endpoint';
import { PodBuilder } from './pod-builder';

export class Kafka {
  constructor(
    protected name: string,
    protected options: {
      image: string;
      zookeeperImage: string;
      env?: kx.types.Container['env'];
    },
  ) {}

  deployZookeeper() {
    const pb = new PodBuilder({
      restartPolicy: 'Always',
      containers: [
        {
          name: 'zookeeper',
          image: this.options.zookeeperImage,
          env: {
            ZOOKEEPER_CLIENT_PORT: '2181',
            ZOOKEEPER_TICK_TIME: '2000',
          },
          ports: [
            {
              name: 'zookeeper',
              containerPort: 2181,
            },
          ],
        },
      ],
    });

    const deployment = new kx.Deployment('kafka-zookeeper', {
      spec: pb.asExtendedDeploymentSpec({
        replicas: 1,
        strategy: {
          type: 'RollingUpdate',
        },
      }),
    });
    const service = deployment.createService({});

    return { deployment, service };
  }

  deployKafka(options: {
    dependencies: pulumi.Resource[];
    zookeeperEnv: kx.types.Container['env'];
  }) {
    const env: any[] = Array.isArray(this.options.env)
      ? this.options.env
      : Object.keys(this.options.env as kx.types.EnvMap).map(name => ({
          name,
          value: (this.options.env as kx.types.EnvMap)[name],
        }));
    const ports = [29092, 9092];
    const pb = new PodBuilder({
      restartPolicy: 'Always',
      containers: [
        {
          name: this.name,
          image: this.options.image,
          env: [
            ...env,
            ...(options.zookeeperEnv as any[]),
            {
              name: 'POD_IP',
              valueFrom: {
                fieldRef: {
                  fieldPath: 'status.podIP',
                },
              },
            },
            {
              name: 'KAFKA_ADVERTISED_LISTENERS',
              value: `PLAINTEXT://$(POD_IP):29092,PLAINTEXT_HOST://localhost:9092`,
            },
          ],
          ports: ports.map(p => ({ name: `kafka-${p}`, containerPort: p })),
          livenessProbe: {
            initialDelaySeconds: 3,
            periodSeconds: 20,
            failureThreshold: 10,
            timeoutSeconds: 5,
            exec: {
              command: [
                'cub',
                'kafka-ready',
                '1',
                '5',
                '-b',
                '127.0.0.1:9092',
                '-c',
                '/etc/kafka/kafka.properties',
              ],
            },
          },
        },
      ],
    });

    const deployment = new kx.Deployment(
      this.name,
      {
        spec: pb.asExtendedDeploymentSpec({
          replicas: 1,
          strategy: {
            type: 'RollingUpdate',
          },
        }),
      },
      {
        dependsOn: options.dependencies,
      },
    );

    const service = deployment.createService({});

    return { deployment, service, ports };
  }

  deploy() {
    const zookeeper = this.deployZookeeper();

    return this.deployKafka({
      dependencies: [zookeeper.deployment, zookeeper.service],
      zookeeperEnv: [
        {
          name: 'KAFKA_ZOOKEEPER_CONNECT',
          value: serviceLocalHost(zookeeper.service).apply(v => `${v}:2181`),
        },
      ],
    });
  }
}
