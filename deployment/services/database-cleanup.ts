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
      image: 'postgres:14.8',
      env: {
        PG_CONNECTION_STRING: rawConnectionString,
        // to make sure we can run this over and over
        IGNORE_RERUN_NONCE: Date.now().toString(),
      },
      command: [
        'psql',
        '$(PG_CONNECTION_STRING)',
        '-c',
        `
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;`,
      ],
    },
    [],
  ).deployAsJob();

  return job;
}
