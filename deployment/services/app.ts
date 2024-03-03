import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { ServiceDeployment } from '../utils/service-deployment';
import { StripeBilling } from './billing';
import { DbMigrations } from './db-migrations';
import { Docker } from './docker';
import { Emails } from './emails';
import { Environment } from './environment';
import { GitHubApp } from './github';
import { GraphQL } from './graphql';
import { Sentry } from './sentry';
import { SlackApp } from './slack-app';
import { Supertokens } from './supertokens';
import { Zendesk } from './zendesk';

export type App = ReturnType<typeof deployApp>;

class AppOAuthSecret extends ServiceSecret<{
  clientId: string | pulumi.Output<string>;
  clientSecret: string | pulumi.Output<string>;
}> {}

export function deployApp({
  graphql,
  dbMigrations,
  image,
  supertokens,
  docker,
  emails,
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
  supertokens: Supertokens;
  emails: Emails;
  zendesk: Zendesk;
  github: GitHubApp;
  slackApp: SlackApp;
  billing: StripeBilling;
  sentry: Sentry;
}) {
  const appConfig = new pulumi.Config('app');
  const appEnv = appConfig.requireObject<Record<string, string>>('env');

  const oauthConfig = new pulumi.Config('oauth');
  const githubOAuthSecret = new AppOAuthSecret('oauth-github', {
    clientId: oauthConfig.requireSecret('githubClient'),
    clientSecret: oauthConfig.requireSecret('githubSecret'),
  });
  const googleOAuthSecret = new AppOAuthSecret('oauth-google', {
    clientId: oauthConfig.requireSecret('googleClient'),
    clientSecret: oauthConfig.requireSecret('googleSecret'),
  });

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
        initialDelaySeconds: 130,
        failureThreshold: 5,
        periodSeconds: 30,
        timeoutSeconds: 15,
      },
      availabilityOnEveryNode: true,
      env: {
        ...environment.env,
        SENTRY: sentry.enabled ? '1' : '0',
        GRAPHQL_ENDPOINT: serviceLocalEndpoint(graphql.service).apply(s => `${s}/graphql`),
        SERVER_ENDPOINT: serviceLocalEndpoint(graphql.service),
        APP_BASE_URL: `https://${environment.appDns}/`,
        INTEGRATION_SLACK: '1',
        INTEGRATION_GITHUB_APP_NAME: github.name,
        GA_TRACKING_ID: appEnv.GA_TRACKING_ID,
        DOCS_URL: 'https://the-guild.dev/graphql/hive/docs',
        GRAPHQL_PERSISTED_OPERATIONS: '1',
        ZENDESK_SUPPORT: zendesk.enabled ? '1' : '0',
        SUPERTOKENS_CONNECTION_URI: supertokens.localEndpoint,
        EMAILS_ENDPOINT: serviceLocalEndpoint(emails.service),
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
    .withSecret('SUPERTOKENS_API_KEY', supertokens.secret, 'apiKey')
    .withSecret('AUTH_GITHUB_CLIENT_ID', githubOAuthSecret, 'clientId')
    .withSecret('AUTH_GITHUB_CLIENT_SECRET', githubOAuthSecret, 'clientSecret')
    .withSecret('AUTH_GOOGLE_CLIENT_ID', googleOAuthSecret, 'clientId')
    .withSecret('AUTH_GOOGLE_CLIENT_SECRET', googleOAuthSecret, 'clientSecret')
    .withConditionalSecret(sentry.enabled, 'SENTRY_DSN', sentry.secret, 'dsn')
    .deploy();
}
