import * as pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import { deployApp } from './services/app';
import { deployStripeBilling } from './services/billing';
import { deployBotKube } from './services/bot-kube';
import { deployCFBroker } from './services/cf-broker';
import { deployCFCDN } from './services/cf-cdn';
import { deployClickhouse } from './services/clickhouse';
import { deployCloudFlareSecurityTransform } from './services/cloudflare-security';
import { deployDatabaseCleanupJob } from './services/database-cleanup';
import { deployDbMigrations } from './services/db-migrations';
import { deployEmails } from './services/emails';
import { deployGraphQL } from './services/graphql';
import { deployKafka } from './services/kafka';
import { deployMetrics } from './services/observability';
import { deployCloudflarePolice } from './services/police';
import { deploySchemaPolicy } from './services/policy';
import { deployProxy } from './services/proxy';
import { provisionCloudflareR2AccessToken } from './services/r2-token';
import { deployRateLimit } from './services/rate-limit';
import { deployRedis } from './services/redis';
import { deploySchema } from './services/schema';
import { deploySuperTokens } from './services/supertokens';
import { deployTokens } from './services/tokens';
import { deployUsage } from './services/usage';
import { deployUsageEstimation } from './services/usage-estimation';
import { deployUsageIngestor } from './services/usage-ingestor';
import { deployWebhooks } from './services/webhooks';
import { DeploymentEnvironment } from './types';
import { optimizeAzureCluster } from './utils/azure-helpers';
import { createDockerImageFactory } from './utils/docker-images';
import { isDefined } from './utils/helpers';

optimizeAzureCluster();

const dockerConfig = new pulumi.Config('docker');
const dockerImages = createDockerImageFactory({
  registryHostname: dockerConfig.require('registryUrl'),
  imagesPrefix: dockerConfig.require('imagesPrefix'),
});

const imagePullSecret = dockerImages.createRepositorySecret(
  dockerConfig.requireSecret('registryAuthBase64'),
);

// eslint-disable-next-line no-process-env
const imagesTag = process.env.DOCKER_IMAGE_TAG as string;

if (!imagesTag) {
  throw new Error(`DOCKER_IMAGE_TAG env variable is not set.`);
}

const envName = pulumi.getStack();
const commonConfig = new pulumi.Config('common');
const appDns = 'app';
const rootDns = commonConfig.require('dnsZone');
const appHostname = `${appDns}.${rootDns}`;

const heartbeatsConfig = new pulumi.Config('heartbeats');
const emailConfig = new pulumi.Config('email');
const r2Config = new pulumi.Config('r2');

const cloudflareConfig = new pulumi.Config('cloudflare');
const r2Token = provisionCloudflareR2AccessToken(
  {
    envName,
    cloudflareAccountId: cloudflareConfig.require('accountId'),
  },
  {
    read: true,
    write: true,
    tokenName: 'Hive CDN',
  },
);

const s3Config = {
  endpoint: r2Config.require('endpoint'),
  bucketName: r2Config.require('bucketName'),
  accessKeyId: r2Token.accessKeyId,
  secretAccessKey: r2Token.secretAccessKey,
};

const deploymentEnv: DeploymentEnvironment = {
  ENVIRONMENT: envName,
  NODE_ENV: 'production',
  DEPLOYED_DNS: appHostname,
};

deployBotKube({ envName });
deployMetrics({ envName });

const cdnAuthPrivateKey = commonConfig.requireSecret('cdnAuthPrivateKey');

const cdn = deployCFCDN({
  envName,
  rootDns,
  s3Config,
  release: imagesTag,
});

const cfBroker = deployCFBroker({
  envName,
  rootDns,
  release: imagesTag,
});

deployCloudflarePolice({ envName, rootDns });

const redisApi = deployRedis({ deploymentEnv });
const kafkaApi = deployKafka();
const clickhouseApi = deployClickhouse();

// eslint-disable-next-line no-process-env
const shouldCleanDatabase = process.env.CLEAN_DATABASE === 'true';
const databaseCleanupJob = shouldCleanDatabase ? deployDatabaseCleanupJob({ deploymentEnv }) : null;

// eslint-disable-next-line no-process-env
const forceRunDbMigrations = process.env.FORCE_DB_MIGRATIONS === 'true';
const dbMigrations = deployDbMigrations({
  clickhouse: clickhouseApi,
  kafka: kafkaApi,
  deploymentEnv,
  image: dockerImages.getImageId('storage', imagesTag),
  imagePullSecret,
  force: forceRunDbMigrations,
  dependencies: [databaseCleanupJob].filter(isDefined),
  s3: s3Config,
  cdnAuthPrivateKey,
});

const tokensApi = deployTokens({
  image: dockerImages.getImageId('tokens', imagesTag),
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
  redis: redisApi,
  heartbeat: heartbeatsConfig.get('tokens'),
  imagePullSecret,
});

const webhooksApi = deployWebhooks({
  image: dockerImages.getImageId('webhooks', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  redis: redisApi,
  heartbeat: heartbeatsConfig.get('webhooks'),
  broker: cfBroker,
});

const emailsApi = deployEmails({
  image: dockerImages.getImageId('emails', imagesTag),
  imagePullSecret,
  release: imagesTag,
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
  image: dockerImages.getImageId('usage-estimator', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  clickhouse: clickhouseApi,
  dbMigrations,
});

const billingApi = deployStripeBilling({
  image: dockerImages.getImageId('stripe-billing', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
  usageEstimator: usageEstimationApi,
});

const rateLimitApi = deployRateLimit({
  image: dockerImages.getImageId('rate-limit', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
  usageEstimator: usageEstimationApi,
  emails: emailsApi,
});

const usageApi = deployUsage({
  image: dockerImages.getImageId('usage', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  tokens: tokensApi,
  kafka: kafkaApi,
  dbMigrations,
  rateLimit: rateLimitApi,
});

const usageIngestorApi = deployUsageIngestor({
  image: dockerImages.getImageId('usage-ingestor', imagesTag),
  imagePullSecret,
  release: imagesTag,
  clickhouse: clickhouseApi,
  kafka: kafkaApi,
  deploymentEnv,
  dbMigrations,
  heartbeat: heartbeatsConfig.get('usageIngestor'),
});

const schemaApi = deploySchema({
  image: dockerImages.getImageId('schema', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  redis: redisApi,
  broker: cfBroker,
});

const schemaPolicyApi = deploySchemaPolicy({
  image: dockerImages.getImageId('policy', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
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

const supertokens = deploySuperTokens(
  { apiKey: supertokensApiKey.result },
  { dependencies: [dbMigrations] },
);

const graphqlApi = deployGraphQL({
  clickhouse: clickhouseApi,
  image: dockerImages.getImageId('server', imagesTag),
  imagePullSecret,
  release: imagesTag,
  deploymentEnv,
  tokens: tokensApi,
  webhooks: webhooksApi,
  schema: schemaApi,
  schemaPolicy: schemaPolicyApi,
  dbMigrations,
  redis: redisApi,
  usage: usageApi,
  cdnAuthPrivateKey,
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
  s3Config,
});

const app = deployApp({
  deploymentEnv,
  graphql: graphqlApi,
  dbMigrations,
  image: dockerImages.getImageId('app', imagesTag),
  imagePullSecret,
  release: imagesTag,
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

const proxy = deployProxy({
  appHostname,
  app,
  graphql: graphqlApi,
  usage: usageApi,
  deploymentEnv,
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
  ignoredHosts: ['cdn.graphql-hive.com', 'cdn.staging.graphql-hive.com'],
});

export const graphqlApiServiceId = graphqlApi.service.id;
export const usageApiServiceId = usageApi.service.id;
export const usageIngestorApiServiceId = usageIngestorApi.service.id;
export const tokensApiServiceId = tokensApi.service.id;
export const schemaApiServiceId = schemaApi.service.id;
export const webhooksApiServiceId = webhooksApi.service.id;

export const appId = app.deployment.id;
export const publicIp = proxy!.status.loadBalancer.ingress[0].ip;
