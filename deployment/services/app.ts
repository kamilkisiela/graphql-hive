import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { GraphQL } from './graphql';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { DeploymentEnvironment } from '../types';
import { PackageHelper } from '../utils/pack';
import { Docs } from './docs';

const appConfig = new pulumi.Config('app');
const commonConfig = new pulumi.Config('common');
const githubAppConfig = new pulumi.Config('ghapp');

const appEnv = appConfig.requireObject<Record<string, string>>('env');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type App = ReturnType<typeof deployApp>;

export function deployApp({
  deploymentEnv,
  docs,
  graphql,
  dbMigrations,
  storageContainer,
  packageHelper,
  supertokensConfig,
  auth0Config,
  googleConfig,
  githubConfig,
  emailsEndpoint,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  graphql: GraphQL;
  dbMigrations: DbMigrations;
  supertokensConfig: {
    endpoint: pulumi.Output<string>;
    apiKey: pulumi.Output<string>;
  };
  auth0Config: {
    internalApiKey: pulumi.Output<string>;
  };
  googleConfig: {
    clientId: pulumi.Output<string>;
    clientSecret: pulumi.Output<string>;
  };
  githubConfig: {
    clientId: pulumi.Output<string>;
    clientSecret: pulumi.Output<string>;
  };
  emailsEndpoint: pulumi.Output<string>;
  docs: Docs;
}) {
  const appRelease = packageHelper.currentReleaseId();

  return new RemoteArtifactAsServiceDeployment(
    'app',
    {
      storageContainer,
      packageInfo: packageHelper.npmPack('@hive/app'),
      readinessProbe: '/api/health',
      livenessProbe: '/api/health',
      env: [
        { name: 'DEPLOYED_DNS', value: deploymentEnv.DEPLOYED_DNS },
        { name: 'NODE_ENV', value: 'production' },
        {
          name: 'ENVIRONMENT',
          value: deploymentEnv.ENVIRONMENT,
        },
        {
          name: 'RELEASE',
          value: appRelease,
        },
        { name: 'SENTRY_DSN', value: commonEnv.SENTRY_DSN },
        { name: 'SENTRY', value: commonEnv.SENTRY_ENABLED },
        {
          name: 'GRAPHQL_ENDPOINT',
          value: serviceLocalEndpoint(graphql.service).apply(s => `${s}/graphql`),
        },
        {
          name: 'SERVER_ENDPOINT',
          value: serviceLocalEndpoint(graphql.service),
        },
        {
          name: 'APP_BASE_URL',
          value: `https://${deploymentEnv.DEPLOYED_DNS}/`,
        },
        {
          name: 'INTEGRATION_SLACK',
          value: '1',
        },
        {
          name: 'INTEGRATION_SLACK_CLIENT_ID',
          value: appEnv.SLACK_CLIENT_ID,
        },
        {
          name: 'INTEGRATION_SLACK_CLIENT_SECRET',
          value: appEnv.SLACK_CLIENT_SECRET,
        },
        {
          name: 'INTEGRATION_GITHUB_APP_NAME',
          value: githubAppConfig.require('name'),
        },

        {
          name: 'STRIPE_PUBLIC_KEY',
          value: appEnv.STRIPE_PUBLIC_KEY,
        },

        {
          name: 'GA_TRACKING_ID',
          value: appEnv.GA_TRACKING_ID,
        },

        {
          name: 'CRISP_WEBSITE_ID',
          value: appEnv.CRISP_WEBSITE_ID,
        },

        {
          name: 'DOCS_URL',
          value: docs.endpoint,
        },

        //
        // AUTH
        //
        {
          name: 'SUPERTOKENS_CONNECTION_URI',
          value: supertokensConfig.endpoint,
        },
        {
          name: 'SUPERTOKENS_API_KEY',
          value: supertokensConfig.apiKey,
        },
        {
          name: 'EMAILS_ENDPOINT',
          value: emailsEndpoint,
        },

        // Auth0 Legacy
        {
          name: 'AUTH_LEGACY_AUTH0',
          value: '1',
        },
        {
          name: 'AUTH_LEGACY_AUTH0_CLIENT_ID',
          value: commonConfig.require('auth0ClientId'),
        },
        {
          name: 'AUTH_LEGACY_AUTH0_CLIENT_SECRET',
          value: commonConfig.requireSecret('auth0ClientSecret'),
        },
        {
          name: 'AUTH_LEGACY_AUTH0_AUDIENCE',
          value: `https://${commonConfig.require('auth0Domain')}/api/v2/`,
        },
        {
          name: 'AUTH_LEGACY_AUTH0_ISSUER_BASE_URL',
          value: `https://${commonConfig.require('auth0Domain')}`,
        },
        {
          name: 'AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT',
          value: serviceLocalEndpoint(graphql.service).apply(s => `${s}/__legacy`),
        },
        {
          name: 'AUTH_LEGACY_AUTH0_INTERNAL_API_KEY',
          value: auth0Config.internalApiKey,
        },
        // GitHub
        {
          name: 'AUTH_GITHUB',
          value: '1',
        },
        {
          name: 'AUTH_GITHUB_CLIENT_ID',
          value: githubConfig.clientId,
        },
        {
          name: 'AUTH_GITHUB_CLIENT_SECRET',
          value: githubConfig.clientSecret,
        },
        // Google
        {
          name: 'AUTH_GOOGLE',
          value: '1',
        },
        {
          name: 'AUTH_GOOGLE_CLIENT_ID',
          value: googleConfig.clientId,
        },
        {
          name: 'AUTH_GOOGLE_CLIENT_SECRET',
          value: googleConfig.clientSecret,
        },
        {
          name: 'AUTH_REQUIRE_EMAIL_VERIFICATION',
          value: '1',
        },
        {
          name: 'AUTH_ORGANIZATION_OIDC',
          value: '1',
        },
      ],
      port: 3000,
    },
    [graphql.service, graphql.deployment, dbMigrations],
  ).deploy();
}
