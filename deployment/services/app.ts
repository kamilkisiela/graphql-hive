import { randomUUID } from 'crypto';
import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { CommerceService } from './commerce';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { EgressPolicyManager } from './egress-policy';
import { Environment } from './environment';
import { GraphQL } from './graphql';
import { Sentry } from './sentry';
import { Zendesk } from './zendesk';

export type App = ReturnType<typeof deployApp>;

export function deployApp({
  graphql,
  dbMigrations,
  publishAppDeploymentCommand,
  image,
  docker,
  zendesk,
  commerce,
  sentry,
  environment,
  egressManager,
}: {
  environment: Environment;
  image: string;
  graphql: GraphQL;
  dbMigrations: DbMigrations;
  docker: Docker;
  zendesk: Zendesk;
  commerce: CommerceService;
  sentry: Sentry;
  publishAppDeploymentCommand: pulumi.Resource | undefined;
  egressManager: EgressPolicyManager;
}) {
  const appConfig = new pulumi.Config('app');
  const appEnv = appConfig.requireObject<Record<string, string>>('env');

  const { deployment, service } = new ServiceDeployment(
    'app',
    {
      image,
      replicas: environment.podsConfig.general.replicas,
      imagePullSecret: docker.secret,
      readinessProbe: '/api/health',
      livenessProbe: '/api/health',
      startupProbe: '/api/health',
      availabilityOnEveryNode: true,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        GRAPHQL_PUBLIC_ENDPOINT: `https://${environment.appDns}/graphql`,
        GRAPHQL_PUBLIC_SUBSCRIPTION_ENDPOINT: `https://${environment.appDns}/graphql/stream`,
        GRAPHQL_PUBLIC_ORIGIN: `https://${environment.appDns}`,
        SERVER_ENDPOINT: serviceLocalEndpoint(graphql.service),
        APP_BASE_URL: `https://${environment.appDns}/`,
        INTEGRATION_SLACK: '1',
        GA_TRACKING_ID: appEnv.GA_TRACKING_ID,
        DOCS_URL: 'https://the-guild.dev/graphql/hive/docs',
        GRAPHQL_PERSISTED_OPERATIONS: publishAppDeploymentCommand ? '1' : '0',
        ZENDESK_SUPPORT: zendesk.enabled ? '1' : '0',
        AUTH_GITHUB: '1',
        AUTH_GOOGLE: '1',
        AUTH_REQUIRE_EMAIL_VERIFICATION: '1',
        AUTH_ORGANIZATION_OIDC: '1',
        MEMBER_ROLES_DEADLINE: appEnv.MEMBER_ROLES_DEADLINE,
        PORT: '3000',
      },
      port: 3000,
    },
    [graphql.service, graphql.deployment, dbMigrations, publishAppDeploymentCommand],
  )
    .withSecret('STRIPE_PUBLIC_KEY', commerce.stripeSecret, 'stripePublicKey')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();

  egressManager
    // GRAPHQL_PUBLIC_ENDPOINT: server-side lab calls use the public endpoint, not SERVER_ENDPOINT.
    ?.allowExternal(deployment, `https://${environment.appDns}`)
    .allowExternal(deployment, sentry.secret?.raw.dsn);

  return { deployment, service };
}
