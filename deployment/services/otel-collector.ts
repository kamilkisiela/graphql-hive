import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { Clickhouse } from './clickhouse';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { GraphQL } from './graphql';

export type OTELCollector = ReturnType<ServiceDeployment['deploy']>;

export function deployOTELCollector(args: {
  image: string;
  environment: Environment;
  docker: Docker;
  clickhouse: Clickhouse;
  dbMigrations: DbMigrations;
  graphql: GraphQL;
  egressManager: EgressPolicyManager;
}) {
  const { deployment, service } = new ServiceDeployment(
    'otel-collector',
    {
      image: args.image,
      imagePullSecret: args.docker.secret,
      env: {
        ...args.environment.envVars,
        HIVE_OTEL_AUTH_ENDPOINT: serviceLocalEndpoint(args.graphql.service).apply(
          value => value + '/otel-auth',
        ),
      },
      /**
       * We are using the healthcheck extension.
       * https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/healthcheckextension
       */
      probePort: 13133,
      readinessProbe: '/',
      livenessProbe: '/',
      startupProbe: '/',
      exposesMetrics: true,
      replicas: args.environment.podsConfig.tracingCollector.replicas,
      pdb: true,
      availabilityOnEveryNode: true,
      port: 4318,
      memory: {
        limit: args.environment.podsConfig.tracingCollector.memoryLimit,
      },
      cpu: {
        limit: args.environment.podsConfig.tracingCollector.cpuMax,
        requests: args.environment.podsConfig.tracingCollector.cpuMin,
      },
      autoScaling: {
        maxReplicas: args.environment.podsConfig.tracingCollector.maxReplicas,
        cpuAverageToScale: 80,
      },
    },
    [args.clickhouse.deployment, args.clickhouse.service, args.dbMigrations],
  )
    .withSecret('CLICKHOUSE_HOST', args.clickhouse.secret, 'host')
    .withSecret('CLICKHOUSE_PORT', args.clickhouse.secret, 'port')
    .withSecret('CLICKHOUSE_USERNAME', args.clickhouse.secret, 'username')
    .withSecret('CLICKHOUSE_PASSWORD', args.clickhouse.secret, 'password')
    .withSecret('CLICKHOUSE_PROTOCOL', args.clickhouse.secret, 'protocol')
    .deploy();

  args.egressManager
    ?.allowExternal(deployment, args.clickhouse.secret.raw.host, args.clickhouse.secret.raw.port)
    .allowInCluster(deployment, args.graphql.deployment);

  return { deployment, service };
}
