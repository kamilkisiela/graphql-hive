import * as pulumi from '@pulumi/pulumi';
import { DeploymentEnvironment } from '../types';
import { isProduction } from '../utils/helpers';
import { ServiceDeployment } from '../utils/service-deployment';

const apiConfig = new pulumi.Config('api');

export function deployDatabaseCleanupJob(options: { deploymentEnv: DeploymentEnvironment }) {
  if (isProduction(options.deploymentEnv)) {
    throw new Error('Database cleanup job is not allowed in "production" environment!');
  }

  const rawConnectionString = apiConfig.requireSecret('postgresConnectionString');

  const { job } = new ServiceDeployment(
    'db-cleanup',
    {
      image: 'jbergknoff/postgresql-client',
      env: {
        PG_CONNECTION_STRING: rawConnectionString,
      },
      args: ['$(PG_CONNECTION_STRING)', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
    },
    [],
  ).deployAsJob();

  return job;
}
