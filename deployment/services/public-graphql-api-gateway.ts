import * as fs from 'fs';
import * as path from 'path';
import * as kx from '@pulumi/kubernetesx';
import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceSecret } from '../utils/secrets';
import { ServiceDeployment } from '../utils/service-deployment';
import { type Docker } from './docker';
import { type EgressPolicyManager } from './egress-policy';
import { type Environment } from './environment';
import { type GraphQL } from './graphql';
import { type Observability } from './observability';
import { type OTELCollector } from './otel-collector';

/**
 * Hive Gateway Docker Image Version
 * Derived from the `@graphql-hive/gateway` version in `deployment/package.json`,
 * so the deployed gateway matches the version the gateway config is typechecked against.
 * Bump the dependency there to update the used gateway version.
 */
const gatewayVersion: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8'),
).devDependencies['@graphql-hive/gateway'];

// On global scope to fail early in case of a non-exact version (e.g. `^2.15.2`)
if (!/^\d+\.\d+\.\d+$/.test(gatewayVersion)) {
  throw new Error(
    `Expected an exact '@graphql-hive/gateway' version in deployment/package.json, got '${gatewayVersion}'.`,
  );
}

const dockerImage = `ghcr.io/graphql-hive/gateway:${gatewayVersion}`;

const gatewayConfigDirectory = path.resolve(
  __dirname,
  '..',
  'config',
  'public-graphql-api-gateway',
);

// On global scope to fail early in case of a read error
const gatewayConfigPath = path.join(gatewayConfigDirectory, 'gateway.config.ts');
const gwConfigFile = fs.readFileSync(gatewayConfigPath, 'utf-8');

export function deployPublicGraphQLAPIGateway(args: {
  environment: Environment;
  graphql: GraphQL;
  docker: Docker;
  observability: Observability;
  otelCollector: OTELCollector;
  egressManager: EgressPolicyManager;
}) {
  const apiConfig = new pulumi.Config('api');

  // Note: The persisted documents cdn endpoint can also be used for reading the contract schema
  const cdnEndpoint =
    apiConfig.requireObject<Record<string, string>>('env')['HIVE_PERSISTED_DOCUMENTS_CDN_ENDPOINT'];

  if (!cdnEndpoint) {
    throw new Error("Missing cdn endpoint variable 'HIVE_PERSISTED_DOCUMENTS_CDN_ENDPOINT'.");
  }

  const hiveConfig = new pulumi.Config('hive');
  const hiveConfigSecrets = new ServiceSecret('hive-secret', {
    otelTraceAccessToken: hiveConfig.requireSecret('otelTraceAccessToken'),
  });

  const supergraphEndpoint = cdnEndpoint + '/contracts/public';

  // Note: The persisted documents access key is also valid for reading the supergraph
  const publicGraphQLAPISecret = new ServiceSecret('public-graphql-api-secret', {
    cdnAccessKeyId: apiConfig.requireSecret('hivePersistedDocumentsCdnAccessKeyId'),
  });

  const configMap = new kx.ConfigMap('public-graphql-api-gateway-config', {
    data: {
      'gateway.config.ts': gwConfigFile,
    },
  });

  const { deployment, service } = new ServiceDeployment(
    'public-graphql-api-gateway',
    {
      imagePullSecret: args.docker.secret,
      image: dockerImage,
      replicas: args.environment.podsConfig.general.replicas,
      availabilityOnEveryNode: true,
      env: {
        GRAPHQL_SERVICE_ENDPOINT: serviceLocalEndpoint(args.graphql.service).apply(
          value => `${value}/graphql-public`,
        ),
        SUPERGRAPH_ENDPOINT: supergraphEndpoint,
        OPENTELEMETRY_COLLECTOR_ENDPOINT: args.observability.tracingEndpoint ?? '',

        // Hive Console OTEL Tracing configuration
        HIVE_HIVE_TRACE_ENDPOINT: serviceLocalEndpoint(args.otelCollector.service).apply(
          value => `${value}/v1/traces`,
        ),
        HIVE_HIVE_TARGET: hiveConfig.require('target'),
        // HIVE_TRACE_ACCESS_TOKEN is a secret
      },
      port: 4000,
      args: ['-c', '/config/gateway.config.ts', 'supergraph'],
      volumes: [
        {
          name: 'gateway-config',
          configMap: {
            name: configMap.metadata.name,
          },
        },
      ],
      volumeMounts: [
        {
          mountPath: '/config/',
          name: 'gateway-config',
          readOnly: true,
        },
      ],
      readinessProbe: '/readiness',
      livenessProbe: '/healthcheck',
      startupProbe: {
        endpoint: '/healthcheck',
        initialDelaySeconds: 60,
        failureThreshold: 10,
        periodSeconds: 15,
        timeoutSeconds: 15,
      },
    },
    [args.graphql.deployment, args.graphql.service],
  )
    .withSecret('HIVE_CDN_ACCESS_TOKEN', publicGraphQLAPISecret, 'cdnAccessKeyId')
    .withSecret('HIVE_HIVE_TRACE_ACCESS_TOKEN', hiveConfigSecrets, 'otelTraceAccessToken')
    .deploy();

  args.egressManager
    ?.allowExternal(deployment, cdnEndpoint)
    .allowInCluster(deployment, args.graphql.deployment)
    .allowInCluster(deployment, args.otelCollector.deployment)
    .allowInCluster(deployment, args.observability.observability?.otlpCollectorService);

  return { deployment, service };
}

export type PublicGraphQLAPIGateway = ReturnType<typeof deployPublicGraphQLAPIGateway>;
