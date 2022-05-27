import * as pulumi from '@pulumi/pulumi';
import { Proxy } from '../utils/reverse-proxy';
import { CertManager } from '../utils/cert-manager';
import { GraphQL } from './graphql';
import { LandingPage } from './landing-page';
import { App } from './app';
import { Usage } from './usage';
import { Docs } from './docs';

const commonConfig = new pulumi.Config('common');

export function deployProxy({
  appHostname,
  docsHostname,
  rootDns,
  graphql,
  app,
  docs,
  usage,
  landingPage,
}: {
  appHostname: string;
  docsHostname: string;
  rootDns: string;
  graphql: GraphQL;
  app: App;
  usage: Usage;
  docs: Docs;
  landingPage: LandingPage;
}) {
  const { tlsIssueName } = new CertManager().deployCertManagerAndIssuer();
  return new Proxy(tlsIssueName, {
    address: commonConfig.get('staticIp'),
  })
    .deployProxy({ replicas: 2 })
    .registerService({ record: rootDns, apex: true }, [
      {
        name: 'landing-page',
        path: '/',
        service: landingPage.service,
      },
    ])
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
      ]
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
      },
      {
        name: 'graphql-api',
        path: '/graphql',
        customRewrite: '/graphql',
        service: graphql.service,
      },
      {
        name: 'usage',
        path: '/usage',
        service: usage.service,
      },
    ])
    .get();
}
