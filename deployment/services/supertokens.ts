import * as kx from '@pulumi/kubernetesx';
import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { ServiceSecret } from '../secrets';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { Postgres } from './postgres';

export class SupertokensSecret extends ServiceSecret<{
  apiKey: string | pulumi.Output<string>;
}> {}

export function deploySuperTokens(
  postgres: Postgres,
  resourceOptions: {
    dependencies: pulumi.Resource[];
  },
  deploymentEnv: DeploymentEnvironment,
) {
  const supertokensApiKey = new random.RandomPassword('supertokens-api-key', {
    length: 31,
    special: false,
  }).result;

  const secret = new SupertokensSecret('supertokens', {
    apiKey: supertokensApiKey,
  });

  const port = 3567;
  const pb = new kx.PodBuilder({
    restartPolicy: 'Always',
    containers: [
      {
        image: 'registry.supertokens.io/supertokens/supertokens-postgresql:7.0',
        name: 'supertokens',
        ports: {
          http: port,
        },
        startupProbe: {
          initialDelaySeconds: 15,
          periodSeconds: 20,
          failureThreshold: 5,
          timeoutSeconds: 5,
          httpGet: {
            path: '/hello',
            port,
          },
        },
        readinessProbe: {
          initialDelaySeconds: 5,
          periodSeconds: 20,
          failureThreshold: 5,
          timeoutSeconds: 5,
          httpGet: {
            path: '/hello',
            port,
          },
        },
        livenessProbe: {
          initialDelaySeconds: 3,
          periodSeconds: 20,
          failureThreshold: 10,
          timeoutSeconds: 5,
          httpGet: {
            path: '/hello',
            port,
          },
        },
        env: {
          POSTGRESQL_TABLE_NAMES_PREFIX: 'supertokens',
          POSTGRESQL_CONNECTION_URI: {
            secretKeyRef: {
              name: postgres.secret.record.metadata.name,
              key: 'connectionStringPostgresql',
            },
          },
          API_KEYS: {
            secretKeyRef: {
              name: secret.record.metadata.name,
              key: 'apiKey',
            },
          },
        },
      },
    ],
  });

  const deployment = new kx.Deployment(
    'supertokens',
    {
      spec: pb.asDeploymentSpec({ replicas: isProduction(deploymentEnv) ? 3 : 1 }),
    },
    {
      dependsOn: resourceOptions.dependencies,
    },
  );

  const service = deployment.createService({});

  return {
    deployment,
    service,
    localEndpoint: serviceLocalEndpoint(service),
    secret,
  };
}

export type Supertokens = ReturnType<typeof deploySuperTokens>;
