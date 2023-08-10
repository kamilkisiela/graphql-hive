import cliProgress from 'cli-progress';
import got from 'got';
import zod from 'zod';
import {
  createSelectStatementForClientsDaily,
  createSelectStatementForCoordinatesDaily,
  createSelectStatementForOperationCollectionBody,
  createSelectStatementForOperationCollectionDetails,
  createSelectStatementForOperationsDaily,
  createSelectStatementForOperationsHourly,
  createSelectStatementForOperationsMinutely,
} from '../clickhouse-actions/004-version-2.js';
import { env } from '../environment.js';

const MigrationModel = zod.object({
  // Write operations to new tables when their timestamp >= YYYY-MM-DD 00:00:00 UTC
  MIGRATION_V2_INGEST_AFTER_UTC: zod
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'MIGRATION_V2_INGEST_AFTER_UTC in YYYY-MM-DD format required'),
});

const InsertStatementsModel = zod.object({
  data: zod.array(
    zod.object({
      year: zod.string(),
      month: zod.string(),
      day: zod.string(),
      insertStatement: zod.string(),
    }),
  ),
});

const ingestAfter = MigrationModel.parse(process.env).MIGRATION_V2_INGEST_AFTER_UTC;

async function main() {
  if (env.clickhouse === null) {
    throw new Error('WTF');
  }
  const { clickhouse } = env;

  const endpoint = `${clickhouse.protocol}://${clickhouse.host}:${clickhouse.port}`;

  function execute(
    query: string,
    options?: {
      progressBar?: cliProgress.SingleBar;
      settings?: Record<string, string>;
    },
  ) {
    return got
      .post(endpoint, {
        body: query,
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
          ...options?.settings,
        },
        headers: {
          Accept: 'text/plain',
        },
        username: clickhouse.username,
        password: clickhouse.password,
      })
      .catch(error => {
        const body = error?.response?.body;
        if (body) {
          console.error(body);
        }

        return Promise.reject(error);
      })
      .then(response => {
        if (options?.progressBar) {
          options.progressBar.increment();
        }
        return Promise.resolve(response);
      });
  }

  const operationsStatements = await execute(`
    SELECT
      partition,
      toString(partition) as partition_string,
      substring(partition_string, 1, 4) as year,
      substring(partition_string, 5, 2) as month,
      substring(partition_string, 7, 2) as day,
      format('INSERT INTO default.operations_new
          SELECT * FROM default.operations
          WHERE timestamp >= toDateTime(\\'{0}-{1}-{2} 00:00:00\\', \\'UTC\\') AND timestamp <= toDateTime(\\'{0}-{1}-{2} 23:59:59\\', \\'UTC\\')
      ', year, month, day) as "insertStatement"
    FROM
      system.parts
    WHERE
      database = 'default'
      AND table = 'operations'
      AND toInt32(partition) < toInt32('${ingestAfter.replace(/-/g, '')}')
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => InsertStatementsModel.parse(JSON.parse(response.body)));

  const progressBar = new cliProgress.MultiBar({}, cliProgress.Presets.shades_classic);

  const operationsTableBar = progressBar.create(operationsStatements.data.length, 0, null, {
    format: 'operations           [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
  });

  for (const record of operationsStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        await execute(record.insertStatement, {
          progressBar: operationsTableBar,
        });
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }
  operationsTableBar.stop();

  const operationCollectionStatements = await execute(`
    SELECT
      partition,
      toString(partition) as partition_string,
      substring(partition_string, 1, 4) as year,
      substring(partition_string, 5, 2) as month,
      substring(partition_string, 7, 2) as day,
      format('INSERT INTO default.operation_collection_new
          SELECT * FROM default.operation_collection
          WHERE timestamp >= toDateTime(\\'{0}-{1}-{2} 00:00:00\\', \\'UTC\\') AND timestamp <= toDateTime(\\'{0}-{1}-{2} 23:59:59\\', \\'UTC\\')
      ', year, month, day) as "insertStatement"
    FROM
      system.parts
    WHERE
      database = 'default'
      AND table = 'operation_collection'
      AND toInt32(partition) < toInt32('${ingestAfter.replace(/-/g, '')}')
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => InsertStatementsModel.parse(JSON.parse(response.body)));

  const operationCollectionTableBar = progressBar.create(
    operationCollectionStatements.data.length,
    0,
    null,
    {
      format: 'operation_collection [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
    },
  );

  for (const record of operationCollectionStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        await execute(record.insertStatement, {
          progressBar: operationCollectionTableBar,
        });
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }

  operationCollectionTableBar.stop();

  const renamingBar = progressBar.create(15, 0, null, {
    format: 'renaming             [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
  });

  // Rename tables
  // Old tables
  await Promise.all([
    execute(`RENAME TABLE default.operations TO default.operations_old`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.operation_collection TO default.operation_collection_old`, {
      progressBar: renamingBar,
    }),
  ]);
  // Old views
  await Promise.all([
    execute(`RENAME TABLE default.operations_hourly TO default.operations_hourly_old`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.operations_daily TO default.operations_daily_old`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.coordinates_daily TO default.coordinates_daily_old`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.clients_daily TO default.clients_daily_old`, {
      progressBar: renamingBar,
    }),
  ]);
  // New tables
  await Promise.all([
    execute(`RENAME TABLE default.operations_new TO default.operations`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.operation_collection_new TO default.operation_collection`, {
      progressBar: renamingBar,
    }),
  ]);
  // New views
  await Promise.all([
    execute(`RENAME TABLE default.operations_minutely_new TO default.operations_minutely`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.operations_hourly_new TO default.operations_hourly`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.operations_daily_new TO default.operations_daily`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.coordinates_daily_new TO default.coordinates_daily`, {
      progressBar: renamingBar,
    }),
    execute(`RENAME TABLE default.clients_daily_new TO default.clients_daily`, {
      progressBar: renamingBar,
    }),
    execute(
      `RENAME TABLE default.operation_collection_body_new TO default.operation_collection_body`,
      {
        progressBar: renamingBar,
      },
    ),
    execute(
      `RENAME TABLE default.operation_collection_details_new TO default.operation_collection_details`,
      {
        progressBar: renamingBar,
      },
    ),
  ]);

  const modifyQueryBar = progressBar.create(7, 0, null, {
    format: 'modifying views      [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}',
  });
  const modifyQuerySettings = { allow_experimental_alter_materialized_view_structure: '1' };
  // Modify AS SELECT queries
  await Promise.all([
    execute(
      `
        ALTER TABLE default.operations_minutely
        MODIFY QUERY ${createSelectStatementForOperationsMinutely('operations')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.operations_hourly
        MODIFY QUERY ${createSelectStatementForOperationsHourly('operations')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.operations_daily
        MODIFY QUERY ${createSelectStatementForOperationsDaily('operations')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.coordinates_daily
        MODIFY QUERY ${createSelectStatementForCoordinatesDaily('operation_collection')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.clients_daily
        MODIFY QUERY ${createSelectStatementForClientsDaily('operations')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.operation_collection_body
        MODIFY QUERY ${createSelectStatementForOperationCollectionBody('operation_collection')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
    execute(
      `
        ALTER TABLE default.operation_collection_details
        MODIFY QUERY ${createSelectStatementForOperationCollectionDetails('operation_collection')}
      `,
      {
        progressBar: modifyQueryBar,
        settings: modifyQuerySettings,
      },
    ),
  ]);

  progressBar.stop();

  console.log(`! Delete old tables and views manually.`);
  console.log(`! It's a manual process to avoid accidental deletion of data.`);

  console.log('\n1. Apply TTLs to new tables');
  console.log(`  ALTER TABLE default.operations MODIFY TTL timestamp + INTERVAL 3 HOUR`);
  console.log(`  ALTER TABLE default.operation_collection MODIFY TTL timestamp + INTERVAL 3 HOUR`);

  console.log('\n2. Drop old tables');
  console.log(`  DROP TABLE default.operations_old`);
  console.log(`  DROP TABLE default.operation_collection_old`);

  console.log('\n3. Drop old views');
  console.log(`  DROP TABLE default.operations_hourly_old`);
  console.log(`  DROP TABLE default.operations_daily_old`);
  console.log(`  DROP TABLE default.coordinates_daily_old`);
  console.log(`  DROP TABLE default.clients_daily_old`);

  console.log('\n4. Enjoy storage size reduction!');
}

main();
