import * as pulumi from '@pulumi/pulumi';
import { CertManager } from '../utils/cert-manager';
import { Proxy } from '../utils/reverse-proxy';
import { App } from './app';
import { Environment } from './environment';
import { GraphQL } from './graphql';
import { Observability } from './observability';
import { Usage } from './usage';

export function deployProxy({
  graphql,
  app,
  usage,
  environment,
  observability,
}: {
  observability: Observability;
  environment: Environment;
  graphql: GraphQL;
  app: App;
  usage: Usage;
}) {
  const { tlsIssueName } = new CertManager().deployCertManagerAndIssuer();
  const commonConfig = new pulumi.Config('common');

  return new Proxy(tlsIssueName, {
    address: commonConfig.get('staticIp'),
    aksReservedIpResourceGroup: commonConfig.get('aksReservedIpResourceGroup'),
  })
    .deployProxy({
      envoy: {
        replicas: environment.isProduction ? 3 : 1,
        cpu: environment.isProduction ? '800m' : '150m',
        memory: environment.isProduction ? '800Mi' : '192Mi',
      },
      tracing: observability.enabled
        ? { collectorService: observability.observability!.otlpCollectorService }
        : undefined,
    })
    .registerService({ record: environment.appDns }, [
      {
        name: 'app',
        path: '/',
        match: 'prefix',
        service: app.service,
        requestTimeout: '60s',
      },
      {
        name: 'server',
        path: '/server',
        match: 'path_separated_prefix',
        service: graphql.service,
        requestTimeout: '60s',
      },
      {
        name: 'registry-api-health',
        path: '/registry/_health',
        match: 'exact',
        customRewrite: '/_health',
        service: graphql.service,
      },
      {
        name: 'registry-api',
        path: '/registry',
        match: 'exact',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'graphql-api-subscriptions',
        path: '/graphql/stream',
        match: 'path_separated_prefix',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: 'infinity',
        // we send a ping every 12 seconds
        idleTimeout: '30s',
        retriable: true,
      },
      {
        name: 'graphql-api',
        path: '/graphql',
        match: 'path_separated_prefix',
        customRewrite: '/graphql',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'auth',
        path: '/auth-api',
        match: 'path_separated_prefix',
        customRewrite: '/auth-api',
        service: graphql.service,
        requestTimeout: '60s',
        retriable: true,
      },
      {
        name: 'usage',
        path: '/usage',
        match: 'exact',
        service: usage.service,
        retriable: true,
      },
    ])
    .get();
}
