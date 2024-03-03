import * as pulumi from '@pulumi/pulumi';
import { deployApp } from './services/app';
import { deployStripeBilling } from './services/billing';
import { deployCFBroker } from './services/cf-broker';
import { deployCFCDN } from './services/cf-cdn';
import { deployClickhouse } from './services/clickhouse';
import { deployCloudFlareSecurityTransform } from './services/cloudflare-security';
import { prepareCommon } from './services/common';
import { deployDatabaseCleanupJob } from './services/database-cleanup';
import { deployDbMigrations } from './services/db-migrations';
import { configureDocker } from './services/docker';
import { deployEmails } from './services/emails';
import { configureGithubApp } from './services/github';
import { deployGraphQL } from './services/graphql';
import { deployKafka } from './services/kafka';
import { deployMetrics } from './services/observability';
import { deploySchemaPolicy } from './services/policy';
import { deployPostgres } from './services/postgres';
import { deployProxy } from './services/proxy';
import { deployRateLimit } from './services/rate-limit';
import { deployRedis } from './services/redis';
import { deployS3 } from './services/s3';
import { deploySchema } from './services/schema';
import { deploySentryEventsMonitor } from './services/sentry-events';
import { configureSlackApp } from './services/slack-app';
import { deploySuperTokens } from './services/supertokens';
import { deployTokens } from './services/tokens';
import { deployUsage } from './services/usage';
import { deployUsageEstimation } from './services/usage-estimation';
import { deployUsageIngestor } from './services/usage-ingestor';
import { deployWebhooks } from './services/webhooks';
import { configureZendesk } from './services/zendesk';
import { DeploymentEnvironment } from './types';
import { optimizeAzureCluster } from './utils/azure-helpers';
import { isDefined, isProduction } from './utils/helpers';

// eslint-disable-next-line no-process-env
const imagesTag = process.env.DOCKER_IMAGE_TAG as string;

if (!imagesTag) {
  throw new Error(`DOCKER_IMAGE_TAG env variable is not set.`);
}

optimizeAzureCluster();

const docker = configureDocker();
const envName = pulumi.getStack();
const commonConfig = new pulumi.Config('common');
const appDns = 'app';
const rootDns = commonConfig.require('dnsZone');
const appHostname = `${appDns}.${rootDns}`;
const heartbeatsConfig = new pulumi.Config('heartbeats');

const deploymentEnv: DeploymentEnvironment = {
  ENVIRONMENT: envName,
  NODE_ENV: 'production',
  DEPLOYED_DNS: appHostname,
};

deploySentryEventsMonitor({ envName, imagePullSecret: docker.secret });
deployMetrics({ envName });

const common = prepareCommon({ release: imagesTag });
const clickhouse = deployClickhouse();
const postgres = deployPostgres();
const redis = deployRedis({ deploymentEnv });
const kafka = deployKafka();
const s3 = deployS3();

const cdn = deployCFCDN({
  envName,
  rootDns,
  s3,
  release: imagesTag,
});

const broker = deployCFBroker({
  envName,
  rootDns,
  release: imagesTag,
});

// eslint-disable-next-line no-process-env
const shouldCleanDatabase = process.env.CLEAN_DATABASE === 'true';
const databaseCleanupJob = shouldCleanDatabase ? deployDatabaseCleanupJob({ deploymentEnv }) : null;

// eslint-disable-next-line no-process-env
const forceRunDbMigrations = process.env.FORCE_DB_MIGRATIONS === 'true';
const dbMigrations = deployDbMigrations({
  clickhouse,
  docker,
  postgres,
  s3,
  cdn,
  deploymentEnv,
  image: docker.factory.getImageId('storage', imagesTag),
  force: forceRunDbMigrations,
  dependencies: [databaseCleanupJob].filter(isDefined),
});

const tokens = deployTokens({
  image: docker.factory.getImageId('tokens', imagesTag),
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
  docker,
  postgres,
  redis,
  heartbeat: heartbeatsConfig.get('tokens'),
});

const webhooks = deployWebhooks({
  image: docker.factory.getImageId('webhooks', imagesTag),
  release: imagesTag,
  deploymentEnv,
  heartbeat: heartbeatsConfig.get('webhooks'),
  broker,
  docker,
  redis,
});

const emails = deployEmails({
  image: docker.factory.getImageId('emails', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  redis,
});

const usageEstimator = deployUsageEstimation({
  image: docker.factory.getImageId('usage-estimator', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  clickhouse,
  dbMigrations,
});

const billing = deployStripeBilling({
  image: docker.factory.getImageId('stripe-billing', imagesTag),
  docker,
  release: imagesTag,
  postgres,
  deploymentEnv,
  dbMigrations,
  usageEstimator,
});

const rateLimit = deployRateLimit({
  image: docker.factory.getImageId('rate-limit', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  dbMigrations,
  usageEstimator,
  emails,
  postgres,
});

const usage = deployUsage({
  image: docker.factory.getImageId('usage', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  tokens,
  kafka,
  dbMigrations,
  rateLimit,
});

const usageIngestor = deployUsageIngestor({
  image: docker.factory.getImageId('usage-ingestor', imagesTag),
  docker,
  release: imagesTag,
  clickhouse,
  kafka,
  deploymentEnv,
  dbMigrations,
  heartbeat: heartbeatsConfig.get('usageIngestor'),
});

const schema = deploySchema({
  image: docker.factory.getImageId('schema', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  redis,
  broker,
  common,
});

const schemaPolicy = deploySchemaPolicy({
  image: docker.factory.getImageId('policy', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
});

const supertokens = deploySuperTokens(postgres, { dependencies: [dbMigrations] }, deploymentEnv);
const zendesk = configureZendesk({ deploymentEnv });
const githubApp = configureGithubApp();
const slackApp = configureSlackApp();

const graphql = deployGraphQL({
  postgres,
  common,
  clickhouse,
  image: docker.factory.getImageId('server', imagesTag),
  docker,
  release: imagesTag,
  deploymentEnv,
  tokens,
  webhooks,
  schema,
  schemaPolicy,
  dbMigrations,
  redis,
  usage,
  cdn,
  usageEstimator,
  rateLimit,
  billing,
  emails,
  supertokens,
  s3,
  zendesk,
  githubApp,
});

const app = deployApp({
  deploymentEnv,
  graphql,
  dbMigrations,
  image: docker.factory.getImageId('app', imagesTag),
  docker,
  release: imagesTag,
  supertokens,
  emails,
  zendesk,
  billing,
  github: githubApp,
  slackApp,
});

const proxy = deployProxy({
  appHostname,
  app,
  graphql,
  usage,
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

export const graphqlApiServiceId = graphql.service.id;
export const usageApiServiceId = usage.service.id;
export const usageIngestorApiServiceId = usageIngestor.service.id;
export const tokensApiServiceId = tokens.service.id;
export const schemaApiServiceId = schema.service.id;
export const webhooksApiServiceId = webhooks.service.id;

export const appId = app.deployment.id;
export const publicIp = proxy!.status.loadBalancer.ingress[0].ip;
