import * as kx from '@pulumi/kubernetesx';
import * as k8s from '@pulumi/kubernetes';
import { PodBuilder } from './pod-builder';

export class Clickhouse {
  constructor(
    protected name: string,
    protected options: {
      env?: kx.types.Container['env'];
      sentryDsn: string;
    }
  ) {}

  deploy() {
    const image = 'clickhouse/clickhouse-server:22.3.5.5-alpine';
    const port = 8123;

    const env: any[] = Array.isArray(this.options.env)
      ? this.options.env
      : Object.keys(this.options.env as kx.types.EnvMap).map(name => ({
          name,
          value: (this.options.env as kx.types.EnvMap)[name],
        }));

    const cm = new kx.ConfigMap('clickhouse-config', {
      data: {
        'config.xml': createConfig({
          sentryDsn: this.options.sentryDsn,
        }),
      },
    });

    const pb = new PodBuilder({
      restartPolicy: 'Always',
      containers: [
        {
          name: this.name,
          image,
          env,
          volumeMounts: [cm.mount('/etc/clickhouse-server/conf.d')],
          ports: {
            http: port,
          },
          readinessProbe: {
            initialDelaySeconds: 5,
            periodSeconds: 20,
            failureThreshold: 5,
            timeoutSeconds: 5,
            httpGet: {
              path: '/ping',
              port,
            },
          },
          livenessProbe: {
            initialDelaySeconds: 3,
            periodSeconds: 20,
            failureThreshold: 10,
            timeoutSeconds: 5,
            httpGet: {
              path: '/ping',
              port,
            },
          },
        },
      ],
    });

    const metadata: k8s.types.input.meta.v1.ObjectMeta = {
      annotations: {},
    };

    const deployment = new kx.Deployment(this.name, {
      spec: pb.asExtendedDeploymentSpec(
        {
          replicas: 1,
          strategy: {
            type: 'RollingUpdate',
          },
        },
        {
          annotations: metadata.annotations,
        }
      ),
    });
    const service = deployment.createService({});

    return { deployment, service, port };
  }
}

const createConfig = ({ sentryDsn }: { sentryDsn: string }) => `<yandex>
    <listen_host>::</listen_host>
    <interserver_http_host>0.0.0.0</interserver_http_host>
    <send_crash_reports>
        <enabled>true</enabled>
        <anonymize>false</anonymize>
        <endpoint>${sentryDsn}</endpoint>
    </send_crash_reports>
    <profiles>
        <default>
            <!-- Data is inserted after max_data_size is exceeded or after busy_timeout_ms after first INSERT query -->
            <async_insert>1</async_insert>
            <!-- The maximum number of threads for background data parsing and insertion. Default is 16 -->
            <async_insert_threads>16</async_insert_threads>
            <!-- The maximum size of the unparsed data in bytes collected per query before being inserted. -->
            <async_insert_max_data_size>5000000</async_insert_max_data_size>
            <!-- The maximum timeout in milliseconds since the first INSERT query before inserting collected data. -->
            <async_insert_busy_timeout_ms>1000</async_insert_busy_timeout_ms>
            <!-- will return OK even if the data wasn't inserted yet -->
            <wait_for_async_insert>0</wait_for_async_insert>
        </default>
    </profiles>
</yandex>
`;
