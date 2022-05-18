import * as pulumi from '@pulumi/pulumi';
import * as azure from '@pulumi/azure';
import { GraphQL } from './graphql';
import { DbMigrations } from './db-migrations';
import { RemoteArtifactAsServiceDeployment } from '../utils/remote-artifact-as-service';
import { serviceLocalEndpoint } from '../utils/local-endpoint';
import { DeploymentEnvironment } from '../types';
import { PackageHelper } from '../utils/pack';

const appConfig = new pulumi.Config('app');
const commonConfig = new pulumi.Config('common');
const githubAppConfig = new pulumi.Config('ghapp');

const appEnv = appConfig.requireObject<Record<string, string>>('env');
const commonEnv = commonConfig.requireObject<Record<string, string>>('env');

export type App = ReturnType<typeof deployApp>;

export function deployApp({
  deploymentEnv,
  graphql,
  dbMigrations,
  storageContainer,
  packageHelper,
}: {
  storageContainer: azure.storage.Container;
  packageHelper: PackageHelper;
  deploymentEnv: DeploymentEnvironment;
  graphql: GraphQL;
  dbMigrations: DbMigrations;
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
        { name: 'ENVIRONMENT', value: deploymentEnv.ENVIRONMENT },
        {
          name: 'NEXT_PUBLIC_ENVIRONMENT',
          value: deploymentEnv.ENVIRONMENT,
        },
        {
          name: 'RELEASE',
          value: appRelease,
        },
        {
          name: 'NEXT_PUBLIC_RELEASE',
          value: appRelease,
        },
        { name: 'AUTH0_DOMAIN', value: commonConfig.require('auth0Domain') },
        {
          name: 'AUTH0_CLIENT_ID',
          value: commonConfig.require('auth0ClientId'),
        },
        {
          name: 'AUTH0_CLIENT_SECRET',
          value: commonConfig.requireSecret('auth0ClientSecret'),
        },
        {
          name: 'AUTH0_BASE_URL',
          value: `https://${deploymentEnv.DEPLOYED_DNS}/`,
        },
        {
          name: 'AUTH0_AUDIENCE',
          value: `https://${commonConfig.require('auth0Domain')}/api/v2/`,
        },
        {
          name: 'AUTH0_ISSUER_BASE_URL',
          value: `https://${commonConfig.require('auth0Domain')}`,
        },
        { name: 'AUTH0_CALLBACK', value: `/api/callback` },
        {
          name: 'POST_LOGOUT_REDIRECT_URI',
          value: `https://${deploymentEnv.DEPLOYED_DNS}/`,
        },
        {
          name: 'AUTH0_SECRET',
          value: commonConfig.requireSecret('cookieSecret'),
        },
        { name: 'AUTH0_SCOPE', value: 'openid profile offline_access' },
        { name: 'SENTRY_DSN', value: commonEnv.SENTRY_DSN },
        { name: 'NEXT_PUBLIC_SENTRY_DSN', value: commonEnv.SENTRY_DSN },
        {
          name: 'GRAPHQL_ENDPOINT',
          value: serviceLocalEndpoint(graphql.service).apply(
            (s) => `${s}/graphql`
          ),
        },
        {
          name: 'APP_BASE_URL',
          value: `https://${deploymentEnv.DEPLOYED_DNS}/`,
        },
        {
          name: 'SLACK_CLIENT_ID',
          value: appEnv.SLACK_CLIENT_ID,
        },
        {
          name: 'SLACK_CLIENT_SECRET',
          value: appEnv.SLACK_CLIENT_SECRET,
        },
        {
          name: 'GITHUB_APP_NAME',
          value: githubAppConfig.require('name'),
        },
      ],
      port: 3000,
    },
    [graphql.service, graphql.deployment, dbMigrations]
  ).deploy();
}
