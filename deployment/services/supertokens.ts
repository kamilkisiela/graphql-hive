import * as kx from '@pulumi/kubernetesx';
import * as pulumi from '@pulumi/pulumi';
import { Output } from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';

export function deploySuperTokens(
  { apiKey }: { apiKey: Output<string> },
  resourceOptions: {
    dependencies: pulumi.Resource[];
  },
) {
  const apiConfig = new pulumi.Config('api');

  const port = 3567;
  const pb = new kx.PodBuilder({
    restartPolicy: 'Always',
    containers: [
      {
        image: 'registry.supertokens.io/supertokens/supertokens-postgresql:6.0',
        name: 'supertokens',
        ports: {
          http: port,
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
          POSTGRESQL_CONNECTION_URI: apiConfig
            .requireSecret('postgresConnectionString')
            .apply(str => str.replace('postgres://', 'postgresql://')),
          API_KEYS: apiKey,
        },
      },
    ],
  });

  const deployment = new kx.Deployment(
    'supertokens',
    {
      spec: pb.asDeploymentSpec({ replicas: 1 }), // <-- here,
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
  };
}
