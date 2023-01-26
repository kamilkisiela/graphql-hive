import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { CertManager } from '../utils/cert-manager';
import { isProduction } from '../utils/helpers';
import { Proxy } from '../utils/reverse-proxy';
import { App } from './app';
import { Docs } from './docs';
import { GraphQL } from './graphql';
import { Tokens } from './tokens';
import { Usage } from './usage';

const commonConfig = new pulumi.Config('common');

export function deployProxy({
  appHostname,
  docsHostname,
  graphql,
  app,
  docs,
  usage,
  tokens,
  deploymentEnv,
}: {
  deploymentEnv: DeploymentEnvironment;
  appHostname: string;
  docsHostname: string;
  graphql: GraphQL;
  app: App;
  usage: Usage;
  tokens: Tokens;
  docs: Docs;
}) {
  const { tlsIssueName } = new CertManager().deployCertManagerAndIssuer();
  return new Proxy(tlsIssueName, {
    address: commonConfig.get('staticIp'),
    aksReservedIpResourceGroup: commonConfig.get('aksReservedIpResourceGroup'),
  })
    .deployProxy({ replicas: isProduction(deploymentEnv) ? 2 : 1 })
    .registerService(
      {
        record: docsHostname,
      },
      [
        {
          name: 'docs',
          path: '/',
          service: docs.service,
        },
      ],
    )
    .registerService({ record: appHostname }, [
      {
        name: 'app',
        path: '/',
        service: app.service,
      },
      {
        name: 'server',
        path: '/server',
        service: graphql.service,
        timeoutInSeconds: 60,
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
        timeoutInSeconds: 60,
        retryOnReset: true,
      },
      {
        name: 'graphql-api',
        path: '/graphql',
        customRewrite: '/graphql',
        service: graphql.service,
        timeoutInSeconds: 60,
        retryOnReset: true,
      },
      {
        name: 'usage',
        path: '/usage',
        service: usage.service,
        retryOnReset: true,
      },
      {
        name: 'tokens',
        path: '/tokens',
        service: tokens.service,
        retryOnReset: true,
      },
    ])
    .get();
}
