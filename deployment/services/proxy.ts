import * as pulumi from '@pulumi/pulumi';
import { CertManager } from '../utils/cert-manager';
import { Proxy } from '../utils/reverse-proxy';
import { App } from './app';
import { Environment } from './environment';
import { GraphQL } from './graphql';
import { Observability } from './observability';
import { OTELCollector } from './otel-collector';
import { type PublicGraphQLAPIGateway } from './public-graphql-api-gateway';
import { Usage } from './usage';

export function deployProxy({
  graphql,
  app,
  usage,
  environment,
  observability,
  publicGraphQLAPIGateway,
  otelCollector,
}: {
  observability: Observability;
  environment: Environment;
  graphql: GraphQL;
  app: App;
  usage: Usage;
  publicGraphQLAPIGateway: PublicGraphQLAPIGateway;
  otelCollector: OTELCollector;
}) {
  const { tlsIssueName } = new CertManager().deployCertManagerAndIssuer();
  const commonConfig = new pulumi.Config('common');

  return new Proxy(tlsIssueName, {
    address: commonConfig.get('staticIp'),
    aksReservedIpResourceGroup: commonConfig.get('aksReservedIpResourceGroup'),
  })
    .deployProxy({
      envoy: {
        replicas: environment.podsConfig.envoy.replicas,
        cpu: environment.podsConfig.envoy.cpuLimit,
        memory: environment.podsConfig.envoy.memoryLimit,
        timeouts: environment.podsConfig.envoy.timeouts,
      },
      tracing: observability.enabled
        ? { collectorService: observability.observability!.otlpCollectorService }
        : undefined,
    })
    .registerService({ record: environment.appDns }, [
      {
        name: 'app',
        path: '/',
        service: app.service,
        requestTimeout: '60s',
      },
      {
        name: 'server',
        path: '/server',
        service: graphql.service,
        requestTimeout: '60s',
      },
      {
        name: 'github-integration',
        path: '/api/github',
        customRewrite: '/api/github',
        service: graphql.service,
        requestTimeout: '60s',
      },
      {
        name: 'slack-integration',
        path: '/api/slack',
        customRewrite: '/api/slack',
        service: graphql.service,
        requestTimeout: '60s',
      },
      {
        name: 'registry-api-health',
        path: '/registry/_health',
        customRewrite: '/_health',
        service: graphql.service,
      },
      {
        name: 'registry-api',
        path: '/registry',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'graphql-api',
        path: '/graphql',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'graphql-api-subscriptions',
        path: '/graphql/stream',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: 'infinity',
        // we send a ping every 12 seconds
        idleTimeout: '30s',
        retriable: true,
      },
      {
        name: 'auth',
        path: '/auth-api',
        customRewrite: '/auth-api',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'usage',
        path: '/usage',
        service: usage.service,
        retriable: true,
        loadBalancerPolicy: 'WeightedLeastRequest',
      },
    ])
    .registerService({ record: environment.apiDns }, [
      {
        name: 'public-graphql-api',
        path: '/graphql',
        customRewrite: '/graphql',
        service: publicGraphQLAPIGateway.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'otel-traces',
        path: '/otel/v1/traces',
        customRewrite: '/v1/traces',
        service: otelCollector.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'scim-provisioning',
        path: '/scim/v2',
        customRewrite: '/scim/v2',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
    ]);
}
