import * as pulumi from '@pulumi/pulumi';
import { deployApp } from './services/app';
import { deployAWSArtifactsLambdaFunction } from './services/aws-artifacts-lambda-function';
import { deployCFBroker } from './services/cf-broker';
import { deployCFCDN } from './services/cf-cdn';
import { deployClickhouse } from './services/clickhouse';
import { deployCloudFlareSecurityTransform } from './services/cloudflare-security';
import { deployCommerce } from './services/commerce';
import { deployDatabaseCleanupJob } from './services/database-cleanup';
import { deployDbMigrations } from './services/db-migrations';
import { configureDocker } from './services/docker';
import { prepareEnvironment } from './services/environment';
import { configureGithubApp } from './services/github';
import { deployGraphQL } from './services/graphql';
import { deployKafka } from './services/kafka';
import { deployObservability } from './services/observability';
import { deployOTELCollector } from './services/otel-collector';
import { deploySchemaPolicy } from './services/policy';
import { deployPostgres } from './services/postgres';
import { deployProxy } from './services/proxy';
import { deployPublicGraphQLAPIGateway } from './services/public-graphql-api-gateway';
import { deployRedis } from './services/redis';
import { deployS3, deployS3AuditLog, deployS3Mirror } from './services/s3';
import { deploySchema } from './services/schema';
import { configureSentry } from './services/sentry';
import { configureSlackApp } from './services/slack-app';
import { deployUsage } from './services/usage';
import { deployUsageIngestor } from './services/usage-ingestor';
import { deployWorkflows, PostmarkSecret } from './services/workflows';
import { configureZendesk } from './services/zendesk';
import { optimizeAzureCluster } from './utils/azure-helpers';
import { isDefined } from './utils/helpers';
import { publishAppDeployment } from './utils/publish-app-deployment';
import { publishGraphQLSchema } from './utils/publish-graphql-schema';
import { ServiceSecret } from './utils/secrets';

// eslint-disable-next-line no-process-env
const imagesTag = process.env.DOCKER_IMAGE_TAG as string;

if (!imagesTag) {
  throw new Error(`DOCKER_IMAGE_TAG env variable is not set.`);
}

// eslint-disable-next-line no-process-env
const graphqlSchemaAbsolutePath: string | undefined = process.env.GRAPHQL_SCHEMA_ABSOLUTE_PATH;

if (!graphqlSchemaAbsolutePath) {
  throw new Error(`GRAPHQL_SCHEMA_ABSOLUTE_PATH env variable is not set.`);
}

// eslint-disable-next-line no-process-env
let hiveAppPersistedDocumentsAbsolutePath: string | undefined =
  process.env.HIVE_APP_PERSISTED_DOCUMENTS_ABSOLUTE_PATH;

if (!hiveAppPersistedDocumentsAbsolutePath) {
  console.warn(
    'HIVE_APP_PERSISTED_DOCUMENTS_ABSOLUTE_PATH env variable is not set, defaulting to "0" (disabled).',
  );
  hiveAppPersistedDocumentsAbsolutePath = undefined;
}

optimizeAzureCluster();

const docker = configureDocker();
const envName = pulumi.getStack();
const heartbeatsConfig = new pulumi.Config('heartbeats');

const emailConfig = new pulumi.Config('email');
const postmarkSecret = new PostmarkSecret('postmark', {
  token: emailConfig.requireSecret('token'),
  from: emailConfig.require('from'),
  messageStream: emailConfig.require('messageStream'),
});

const sentry = configureSentry();
const environment = prepareEnvironment({
  release: imagesTag,
  environment: envName,
  rootDns: new pulumi.Config('common').require('dnsZone'),
});
const observability = deployObservability({ environment });
const clickhouse = deployClickhouse();
const postgres = deployPostgres();
const redis = deployRedis({ environment });
const kafka = deployKafka();
const s3 = deployS3();
const s3Mirror = deployS3Mirror();
const s3AuditLog = deployS3AuditLog();

const cdn = deployCFCDN({
  s3,
  s3Mirror,
  sentry,
  environment,
});

const lambdaFunction = deployAWSArtifactsLambdaFunction({
  s3Mirror,
  environment,
});

const broker = deployCFBroker({
  environment,
  sentry,
});

// eslint-disable-next-line no-process-env
const shouldCleanDatabase = process.env.CLEAN_DATABASE === 'true';
const databaseCleanupJob = shouldCleanDatabase ? deployDatabaseCleanupJob({ environment }) : null;

// eslint-disable-next-line no-process-env
const forceRunDbMigrations = process.env.FORCE_DB_MIGRATIONS === 'true';
const dbMigrations = deployDbMigrations({
  clickhouse,
  docker,
  postgres,
  redis,
  s3,
  cdn,
  environment,
  image: docker.factory.getImageId('storage', imagesTag),
  force: forceRunDbMigrations,
  dependencies: [databaseCleanupJob].filter(isDefined),
});

const commerce = deployCommerce({
  image: docker.factory.getImageId('commerce', imagesTag),
  docker,
  environment,
  clickhouse,
  dbMigrations,
  sentry,
  observability,
  postgres,
});

const usage = deployUsage({
  image: docker.factory.getImageId('usage', imagesTag),
  docker,
  environment,
  redis,
  postgres,
  kafka,
  dbMigrations,
  commerce,
  sentry,
  observability,
});

const usageIngestor = deployUsageIngestor({
  image: docker.factory.getImageId('usage-ingestor', imagesTag),
  docker,
  clickhouse,
  kafka,
  environment,
  dbMigrations,
  heartbeat: heartbeatsConfig.get('usageIngestor'),
  sentry,
});

const schema = deploySchema({
  image: docker.factory.getImageId('schema', imagesTag),
  docker,
  environment,
  redis,
  broker,
  sentry,
  observability,
});

const schemaPolicy = deploySchemaPolicy({
  image: docker.factory.getImageId('policy', imagesTag),
  docker,
  environment,
  sentry,
  observability,
});

deployWorkflows({
  image: docker.factory.getImageId('workflows', imagesTag),
  docker,
  environment,
  postgres,
  postmarkSecret,
  observability,
  sentry,
  heartbeat: heartbeatsConfig.get('webhooks'),
  schema,
  redis,
  clickhouse,
  dbMigrations,
});

const zendesk = configureZendesk({ environment });
const githubApp = configureGithubApp();
const slackApp = configureSlackApp();

const graphql = deployGraphQL({
  postgres,
  environment,
  clickhouse,
  image: docker.factory.getImageId('server', imagesTag),
  docker,
  schema,
  schemaPolicy,
  dbMigrations,
  redis,
  usage,
  cdn,
  commerce,
  s3,
  s3Mirror,
  s3AuditLog,
  zendesk,
  githubApp,
  sentry,
  observability,
});

const hiveConfig = new pulumi.Config('hive');
const hiveConfigSecret = new ServiceSecret('hive-config-secret', {
  usageAccessToken: hiveConfig.requireSecret('cliAccessToken'),
});

// You can change this to `false` in cases when you don't want to publish commands.
// For example, if the entire env is down or if you are having SSL issues.
// eslint-disable-next-line no-process-env
const RUN_PUBLISH_COMMANDS: boolean = process.env.SKIP_PUBLISH_COMMANDS !== '1';

const publishGraphQLSchemaCommand = RUN_PUBLISH_COMMANDS
  ? publishGraphQLSchema({
      graphql,
      registry: {
        endpoint: `https://${environment.appDns}/registry`,
        accessToken: hiveConfigSecret.raw.usageAccessToken,
        target: hiveConfig.require('target'),
      },
      version: {
        commit: imagesTag,
      },
      schemaPath: graphqlSchemaAbsolutePath,
    })
  : null;

let publishAppDeploymentCommand: pulumi.Resource | undefined;

if (hiveAppPersistedDocumentsAbsolutePath && RUN_PUBLISH_COMMANDS) {
  publishAppDeploymentCommand = publishAppDeployment({
    appName: 'hive-app',
    registry: {
      endpoint: `https://${environment.appDns}/registry`,
      accessToken: hiveConfigSecret.raw.usageAccessToken,
      target: hiveConfig.require('target'),
    },
    version: {
      commit: imagesTag,
    },
    persistedDocumentsPath: hiveAppPersistedDocumentsAbsolutePath,
    wakeupClickhouse: environment.isProduction
      ? null
      : {
          clickhouse: clickhouse.secret,
          dockerSecret: docker.secret,
        },
    // We need to wait until the new GraphQL schema is published before we can publish the app deployment.
    dependsOn: publishGraphQLSchemaCommand ? [publishGraphQLSchemaCommand] : [],
  });
}

const otelCollector = deployOTELCollector({
  environment,
  graphql,
  dbMigrations,
  clickhouse,
  image: docker.factory.getImageId('otel-collector', imagesTag),
  docker,
});

const app = deployApp({
  environment,
  graphql,
  publishAppDeploymentCommand,
  dbMigrations,
  image: docker.factory.getImageId('app', imagesTag),
  docker,
  zendesk,
  commerce,
  github: githubApp,
  slackApp,
  sentry,
});

const publicGraphQLAPIGateway = deployPublicGraphQLAPIGateway({
  environment,
  graphql,
  docker,
  observability,
  otelCollector,
});

const proxy = deployProxy({
  observability,
  app,
  graphql,
  usage,
  environment,
  publicGraphQLAPIGateway,
  otelCollector,
});

deployCloudFlareSecurityTransform({
  environment,
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
  ],
});

export const graphqlApiServiceId = graphql.service.id;
export const usageApiServiceId = usage.service.id;
export const usageIngestorApiServiceId = usageIngestor.service.id;
export const schemaApiServiceId = schema.service.id;

export const appId = app.deployment.id;
export const otelCollectorId = otelCollector.deployment.id;
export const publicIp = proxy.get()!.status.loadBalancer.ingress[0].ip;
export const awsLambdaArtifactsFunctionUrl = lambdaFunction;
