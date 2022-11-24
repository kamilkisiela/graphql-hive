import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from './types';
import { deployDbMigrations } from './services/db-migrations';
import { deployTokens } from './services/tokens';
import { deployWebhooks } from './services/webhooks';
import { deployEmails } from './services/emails';
import { deploySchema } from './services/schema';
import { deployUsage } from './services/usage';
import { deployUsageIngestor } from './services/usage-ingestor';
import { deployGraphQL } from './services/graphql';
import { deployApp } from './services/app';
import { deployLandingPage } from './services/landing-page';
import { deployDocs } from './services/docs';
import { deployRedis } from './services/redis';
import { deployKafka } from './services/kafka';
import { deployMetrics } from './services/observability';
import { deployCFCDN } from './services/cf-cdn';
import { deployCFBroker } from './services/cf-broker';
import { deployCloudflarePolice } from './services/police';
import { deployBotKube } from './services/bot-kube';
import { deployProxy } from './services/proxy';
import { deployClickhouse } from './services/clickhouse';
import { deployUsageEstimation } from './services/usage-estimation';
import { deploySuperTokens } from './services/supertokens';
import { createPackageHelper } from './utils/pack';
import * as azure from '@pulumi/azure';
import { optimizeAzureCluster } from './utils/azure-helpers';
import { deployRateLimit } from './services/rate-limit';
import { deployStripeBilling } from './services/billing';
import { deployCloudFlareSecurityTransform } from './services/cloudflare-security';
import * as random from '@pulumi/random';

const packageHelper = createPackageHelper();

optimizeAzureCluster();

const envName = pulumi.getStack();
const commonConfig = new pulumi.Config('common');
const appDns = 'app';
const docsDns = 'docs';
const rootDns = commonConfig.require('dnsZone');
const appHostname = `${appDns}.${rootDns}`;
const docsHostname = `${docsDns}.${rootDns}`;

const heartbeatsConfig = new pulumi.Config('heartbeats');
const emailConfig = new pulumi.Config('email');

const resourceGroup = new azure.core.ResourceGroup(`hive-${envName}-rg`, {
  location: azure.Locations.EastUS,
});

const storageAccount = new azure.storage.Account(`hive${envName}`, {
  resourceGroupName: resourceGroup.name,
  accountReplicationType: 'LRS',
  accountTier: 'Standard',
  accountKind: 'StorageV2',
  publicNetworkAccessEnabled: true,
});

const storageContainer = new azure.storage.Container('deploy-artifacts', {
  storageAccountName: storageAccount.name,
  containerAccessType: 'blob',
});

const deploymentEnv: DeploymentEnvironment = {
  ENVIRONMENT: envName,
  NODE_ENV: 'production',
  DEPLOYED_DNS: appHostname,
};

deployBotKube({ envName });
deployMetrics({ envName });

const cdn = deployCFCDN({
  envName,
  rootDns,
  packageHelper,
});

const cfBroker = deployCFBroker({
  envName,
  rootDns,
  packageHelper,
});

deployCloudflarePolice({ envName, rootDns });

const redisApi = deployRedis({ deploymentEnv });

const kafkaApi = deployKafka();

const clickhouseApi = deployClickhouse();

const dbMigrations = deployDbMigrations({
  storageContainer,
  packageHelper,
  clickhouse: clickhouseApi,
  kafka: kafkaApi,
  deploymentEnv,
});

const tokensApi = deployTokens({
  packageHelper,
  storageContainer,
  deploymentEnv,
  dbMigrations,
  heartbeat: heartbeatsConfig.get('tokens'),
});

const webhooksApi = deployWebhooks({
  packageHelper,
  storageContainer,
  deploymentEnv,
  redis: redisApi,
  heartbeat: heartbeatsConfig.get('webhooks'),
  broker: cfBroker,
});

const emailsApi = deployEmails({
  packageHelper,
  storageContainer,
  deploymentEnv,
  redis: redisApi,
  email: {
    token: emailConfig.requireSecret('token'),
    from: emailConfig.require('from'),
    messageStream: emailConfig.require('messageStream'),
  },
  // heartbeat: heartbeatsConfig.get('emails'),
});

const usageEstimationApi = deployUsageEstimation({
  packageHelper,
  storageContainer,
  deploymentEnv,
  clickhouse: clickhouseApi,
  dbMigrations,
});

const billingApi = deployStripeBilling({
  packageHelper,
  storageContainer,
  deploymentEnv,
  dbMigrations,
  usageEstimator: usageEstimationApi,
});

const rateLimitApi = deployRateLimit({
  packageHelper,
  storageContainer,
  deploymentEnv,
  dbMigrations,
  usageEstimator: usageEstimationApi,
  emails: emailsApi,
});

const usageApi = deployUsage({
  packageHelper,
  storageContainer,
  deploymentEnv,
  tokens: tokensApi,
  kafka: kafkaApi,
  dbMigrations,
  rateLimit: rateLimitApi,
});

const usageIngestorApi = deployUsageIngestor({
  clickhouse: clickhouseApi,
  kafka: kafkaApi,
  packageHelper,
  storageContainer,
  deploymentEnv,
  dbMigrations,
  heartbeat: heartbeatsConfig.get('usageIngestor'),
});

const schemaApi = deploySchema({
  packageHelper,
  storageContainer,
  deploymentEnv,
  redis: redisApi,
  broker: cfBroker,
});

const supertokensApiKey = new random.RandomPassword('supertokens-api-key', {
  length: 31,
  special: false,
});
const auth0LegacyMigrationKey = new random.RandomPassword('auth0-legacy-migration-key', {
  length: 69,
  special: false,
});

const oauthConfig = new pulumi.Config('oauth');

const githubConfig = {
  clientId: oauthConfig.requireSecret('githubClient'),
  clientSecret: oauthConfig.requireSecret('githubSecret'),
};

const googleConfig = {
  clientId: oauthConfig.requireSecret('googleClient'),
  clientSecret: oauthConfig.requireSecret('googleSecret'),
};

const supertokens = deploySuperTokens({ apiKey: supertokensApiKey.result });

const graphqlApi = deployGraphQL({
  clickhouse: clickhouseApi,
  packageHelper,
  storageContainer,
  deploymentEnv,
  tokens: tokensApi,
  webhooks: webhooksApi,
  schema: schemaApi,
  dbMigrations,
  redis: redisApi,
  usage: usageApi,
  cdn,
  usageEstimator: usageEstimationApi,
  rateLimit: rateLimitApi,
  billing: billingApi,
  emails: emailsApi,
  supertokensConfig: {
    apiKey: supertokensApiKey.result,
    endpoint: supertokens.localEndpoint,
  },
  auth0Config: {
    internalApiKey: auth0LegacyMigrationKey.result,
  },
});

const docs = deployDocs({
  rootDns,
  packageHelper,
  storageContainer,
});

const app = deployApp({
  deploymentEnv,
  docs,
  graphql: graphqlApi,
  dbMigrations,
  packageHelper,
  storageContainer,
  supertokensConfig: {
    apiKey: supertokensApiKey.result,
    endpoint: supertokens.localEndpoint,
  },
  auth0Config: {
    internalApiKey: auth0LegacyMigrationKey.result,
  },
  githubConfig,
  googleConfig,
  emailsEndpoint: emailsApi.localEndpoint,
});

const landingPage = deployLandingPage({
  rootDns,
  packageHelper,
  storageContainer,
});

const proxy = deployProxy({
  rootDns,
  appHostname,
  docsHostname,
  app,
  landingPage,
  docs,
  graphql: graphqlApi,
  usage: usageApi,
});

deployCloudFlareSecurityTransform({
  envName,
  // Paths used by 3rd-party software.
  // The CF Page Rules should not affect them and do not apply any special security headers.
  ignoredPaths: [
    '/api/auth',
    '/api/health',
    '/usage',
    '/graphql',
    '/registry',
    '/server',
    '/api/github',
    '/api/slack',
    '/api/lab',
  ],
});

export const graphqlApiServiceId = graphqlApi.service.id;
export const usageApiServiceId = usageApi.service.id;
export const usageIngestorApiServiceId = usageIngestorApi.service.id;
export const tokensApiServiceId = tokensApi.service.id;
export const schemaApiServiceId = schemaApi.service.id;
export const webhooksApiServiceId = webhooksApi.service.id;

export const appId = app.deployment.id;
export const publicIp = proxy!.status.loadBalancer.ingress[0].ip;
