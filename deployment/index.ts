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
import { optimizeAzureCluster } from './utils/azure-helpers';
import { deployRateLimit } from './services/rate-limit';
import { deployStripeBilling } from './services/billing';
import { deployCloudFlareSecurityTransform } from './services/cloudflare-security';
import { createDockerImageFactory } from './utils/docker-images';
import * as random from '@pulumi/random';

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
const imagesTag = process.env.DOCKER_IMAGE_TAG;

if (!imagesTag) {
  throw new Error(`DOCKER_IMAGE_TAG env variable is not set.`);
}

const envName = pulumi.getStack();
const commonConfig = new pulumi.Config('common');
const appDns = 'app';
const docsDns = 'docs';
const rootDns = commonConfig.require('dnsZone');
const appHostname = `${appDns}.${rootDns}`;
const docsHostname = `${docsDns}.${rootDns}`;

const heartbeatsConfig = new pulumi.Config('heartbeats');
const emailConfig = new pulumi.Config('email');
const r2Config = new pulumi.Config('r2');

const s3Config = {
  endpoint: r2Config.require('endpoint'),
  bucketName: r2Config.require('bucketName'),
  accessKeyId: r2Config.requireSecret('accessKeyId'),
  secretAccessKey: r2Config.requireSecret('secretAccessKey'),
};

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

const dbMigrations = deployDbMigrations({
  clickhouse: clickhouseApi,
  kafka: kafkaApi,
  deploymentEnv,
  image: dockerImages.getImageId('storage', imagesTag),
  imagePullSecret,
});

const tokensApi = deployTokens({
  image: dockerImages.getImageId('tokens', imagesTag),
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
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
  image: dockerImages.getImageId('server', imagesTag),
  imagePullSecret,
  release: imagesTag,
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
  s3Config,
});

const docs = deployDocs({
  rootDns,
  image: dockerImages.getImageId('docs', imagesTag),
  imagePullSecret,
  release: imagesTag,
});

const app = deployApp({
  deploymentEnv,
  docs,
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
  docsHostname,
  app,
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
