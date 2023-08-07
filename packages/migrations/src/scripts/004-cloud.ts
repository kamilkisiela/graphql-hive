import got from 'got';
import zod from 'zod';
import { env } from '../environment.js';

const MigrationModel = zod.object({
  // Write operations to new tables when their timestamp >= YYYY-MM-DD 00:00:00 UTC
  MIGRATION_V2_INGEST_AFTER_UTC: zod
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
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

  function execute(query: string) {
    return got
      .post(endpoint, {
        body: query,
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
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
      AND toInt32(partition) < toInt32('${ingestAfter}')
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => InsertStatementsModel.parse(JSON.parse(response.body)));

  for (const record of operationsStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        console.log(
          `insert rows from 'operations' ${record.year}-${record.month}-${record.day} ${retry}`,
        );
        await execute(record.insertStatement);
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }

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
      AND toInt32(partition) < toInt32('${ingestAfter}')
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => InsertStatementsModel.parse(JSON.parse(response.body)));

  for (const record of operationCollectionStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        console.log(
          `insert rows from 'operation_collection' ${record.year}-${record.month}-${record.day} ${retry}`,
        );
        await execute(record.insertStatement);
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }

  // Rename tables
  // Old tables
  await Promise.all([
    execute(`RENAME TABLE default.operations TO default.operations_old`),
    execute(`RENAME TABLE default.operation_collection TO default.operation_collection_old`),
  ]);
  // Old views
  await Promise.all([
    execute(`RENAME TABLE default.operations_hourly TO default.operations_hourly_old`),
    execute(`RENAME TABLE default.operations_daily TO default.operations_daily_old`),
    execute(`RENAME TABLE default.coordinates_daily TO default.coordinates_daily_old`),
    execute(`RENAME TABLE default.clients_daily TO default.clients_daily_old`),
  ]);
  // New tables
  await Promise.all([
    execute(`RENAME TABLE default.operations_new TO default.operations`),
    execute(`RENAME TABLE default.operation_collection_new TO default.operation_collection`),
  ]);
  // New views
  await Promise.all([
    execute(`RENAME TABLE default.operations_minutely_new TO default.operations_minutely`),
    execute(`RENAME TABLE default.operations_hourly_new TO default.operations_hourly`),
    execute(`RENAME TABLE default.operations_daily_new TO default.operations_daily`),
    execute(`RENAME TABLE default.coordinates_daily_new TO default.coordinates_daily`),
    execute(`RENAME TABLE default.clients_daily_new TO default.clients_daily`),
    execute(
      `RENAME TABLE default.operation_collection_body_new TO default.operation_collection_body`,
    ),
    execute(
      `RENAME TABLE default.operation_collection_details_new TO default.operation_collection_details`,
    ),
  ]);

  // Do the rest of the migration manually, when it's the right time.

  // Apply TTLs to new tables
  // await Promise.all([
  //   execute(`ALTER TABLE default.operations ADD TTL timestamp + INTERVAL 3 HOURS`),
  //   execute(`ALTER TABLE default.operation_collection ADD TTL timestamp + INTERVAL 3 HOURS`),
  // ]);

  // Drop old tables
  // await Promise.all([
  //   execute(`DROP TABLE default.operations_old`),
  //   execute(`DROP TABLE default.operation_collection_old`),
  // ]);
  // Drop old views
  // await Promise.all([
  //   execute(`DROP TABLE default.operations_hourly_old`),
  //   execute(`DROP TABLE default.operations_daily_old`),
  //   execute(`DROP TABLE default.coordinates_daily_old`),
  //   execute(`DROP TABLE default.clients_daily_old`),
  // ]);
}

main();
