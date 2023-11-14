import * as k8s from '@pulumi/kubernetes';
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

  const configMap = new k8s.core.v1.ConfigMap('db-cleanup-script', {
    data: {
      'db-cleanup.sql': /* sql */ `
DO $$
DECLARE
  r RECORD;
BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
      ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;

      FOR r IN (
        SELECT oi.type_name from ( SELECT      t.typname as "type_name" FROM        pg_type t LEFT JOIN   pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE       (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid)) AND     NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid) AND     n.nspname NOT IN ('pg_catalog', 'information_schema')) as "oi"
      ) LOOP
          EXECUTE 'DROP TYPE ' || quote_ident(r.type_name);
      END LOOP;
END $$;
`,
    },
  });

  const { job } = new ServiceDeployment(
    'db-cleanup',
    {
      image: 'postgres:14.10',
      env: {
        PG_CONNECTION_STRING: rawConnectionString,
        // to make sure we can run this over and over
        IGNORE_RERUN_NONCE: Date.now().toString(),
      },
      volumes: [
        {
          name: 'script',
          configMap: {
            name: configMap.metadata.name,
          },
        },
      ],
      volumeMounts: [
        {
          mountPath: '/scripts/',
          name: 'script',
          readOnly: true,
        },
      ],
      command: ['psql', '$(PG_CONNECTION_STRING)', '-f', '/scripts/db-cleanup.sql'],
    },
    [],
  ).deployAsJob();

  return job;
}
