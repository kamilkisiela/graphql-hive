import * as pulumi from '@pulumi/pulumi';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { StripeBilling } from './billing';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Environment } from './environment';
import { GitHubApp } from './github';
import { GraphQL } from './graphql';
import { Sentry } from './sentry';
import { SlackApp } from './slack-app';
import { Zendesk } from './zendesk';

export type App = ReturnType<typeof deployApp>;

export function deployApp({
  graphql,
  dbMigrations,
  image,
  docker,
  zendesk,
  github,
  slackApp,
  billing,
  sentry,
  environment,
}: {
  environment: Environment;
  image: string;
  graphql: GraphQL;
  dbMigrations: DbMigrations;
  docker: Docker;
  zendesk: Zendesk;
  github: GitHubApp;
  slackApp: SlackApp;
  billing: StripeBilling;
  sentry: Sentry;
}) {
  const appConfig = new pulumi.Config('app');
  const appEnv = appConfig.requireObject<Record<string, string>>('env');

  return new ServiceDeployment(
    'app',
    {
      image,
      replicas: environment.isProduction ? 3 : 1,
      imagePullSecret: docker.secret,
      readinessProbe: '/api/health',
      livenessProbe: '/api/health',
      startupProbe: {
        endpoint: '/api/health',
        initialDelaySeconds: 60,
        failureThreshold: 10,
        periodSeconds: 30,
        timeoutSeconds: 15,
      },
      availabilityOnEveryNode: true,
      env: {
        ...environment.envVars,
        SENTRY: sentry.enabled ? '1' : '0',
        GRAPHQL_PUBLIC_ENDPOINT: `https://${environment.appDns}/graphql`,
        GRAPHQL_PUBLIC_ORIGIN: `https://${environment.appDns}`,
        SERVER_ENDPOINT: serviceLocalEndpoint(graphql.service),
        APP_BASE_URL: `https://${environment.appDns}/`,
        INTEGRATION_SLACK: '1',
        INTEGRATION_GITHUB_APP_NAME: github.name,
        GA_TRACKING_ID: appEnv.GA_TRACKING_ID,
        DOCS_URL: 'https://the-guild.dev/graphql/hive/docs',
        GRAPHQL_PERSISTED_OPERATIONS: '1',
        ZENDESK_SUPPORT: zendesk.enabled ? '1' : '0',
        AUTH_GITHUB: '1',
        AUTH_GOOGLE: '1',
        AUTH_REQUIRE_EMAIL_VERIFICATION: '1',
        AUTH_ORGANIZATION_OIDC: '1',
        MEMBER_ROLES_DEADLINE: appEnv.MEMBER_ROLES_DEADLINE,
      },
      port: 3000,
    },
    [graphql.service, graphql.deployment, dbMigrations],
  )
    .withSecret('INTEGRATION_SLACK_CLIENT_ID', slackApp.secret, 'clientId')
    .withSecret('INTEGRATION_SLACK_CLIENT_SECRET', slackApp.secret, 'clientSecret')
    .withSecret('STRIPE_PUBLIC_KEY', billing.secret, 'stripePublicKey')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
