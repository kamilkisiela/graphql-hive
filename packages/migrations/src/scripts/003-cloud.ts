import got from 'got';
import zod from 'zod';
import { env } from '../environment';

const Model = zod.object({
  data: zod.array(
    zod.object({
      year: zod.string(),
      month: zod.string(),
      day: zod.string(),
      insertStatement: zod.string(),
    }),
  ),
});

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

  const operationsDailyStatements = await execute(`
    SELECT
      partition,
      toString(partition) as partition_string,
      substring(partition_string, 1, 4) as year,
      substring(partition_string, 5, 2) as month,
      substring(partition_string, 7, 2) as day,
      format('INSERT INTO default.operations_daily_new
          SELECT
            target,
            toStartOfDay(timestamp) AS timestamp,
            toStartOfDay(expires_at) AS expires_at,
            hash,
            client_name,
            count() AS total,
            sum(ok) AS total_ok,
            avgState(duration) AS duration_avg,
            quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
          FROM
          default.operations
          WHERE timestamp >= toDateTime(\\'{0}-{1}-{2} 00:00:00\\', \\'UTC\\') AND timestamp <= toDateTime(\\'{0}-{1}-{2} 23:59:59\\', \\'UTC\\')
          GROUP BY
            target,
            client_name,
            client_version,
            hash,
            timestamp_day,
            expires_at
      ', year, month, day) as "insertStatement"
    FROM
      system.parts
    WHERE
      database = 'default'
      AND table = 'operations'
      AND toInt32(partition) < toInt32((SELECT toYYYYMMDD(fromUnixTimestamp(minMerge(timestamp))) FROM default.operations_migration))
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => Model.parse(JSON.parse(response.body)));

  for (const record of operationsDailyStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        console.log(`insert daily ${record.year}-${record.month}-${record.day} ${retry}`);
        await execute(record.insertStatement);
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }

  const operationsHourlyStatements = await execute(`
    SELECT
      partition,
      toString(partition) as partition_string,
      substring(partition_string, 1, 4) as year,
      substring(partition_string, 5, 2) as month,
      substring(partition_string, 7, 2) as day,
      format('INSERT INTO default.operations_hourly_new
          SELECT
            target,
            toStartOfDay(timestamp) AS timestamp,
            toStartOfDay(expires_at) AS expires_at,
            hash,
            client_name,
            count() AS total,
            sum(ok) AS total_ok,
            avgState(duration) AS duration_avg,
            quantilesState(0.75, 0.9, 0.95, 0.99)(duration) AS duration_quantiles
          FROM
          default.operations
          WHERE timestamp >= toDateTime(\\'{0}-{1}-{2} 00:00:00\\', \\'UTC\\') AND timestamp <= toDateTime(\\'{0}-{1}-{2} 23:59:59\\', \\'UTC\\')
          GROUP BY
            target,
            client_name,
            client_version,
            hash,
            timestamp_day,
            expires_at
      ', year, month, day) as insert_statement
    FROM
      system.parts
    WHERE
      database = 'default'
      AND table = 'operations'
      AND toInt32(partition) < toInt32((SELECT toYYYYMMDD(fromUnixTimestamp(minMerge(timestamp))) FROM default.operations_migration))
    GROUP BY
      database,
      table,
      partition
    ORDER BY
      partition ASC
    ;
  `).then(response => Model.parse(JSON.parse(response.body)));

  for (const record of operationsHourlyStatements.data) {
    let retry = 0;

    while (true) {
      if (retry > 5) {
        throw new Error('Exceeded retry limit. Aborting.');
      }
      try {
        retry++;
        console.log(`insert hourly ${record.year}-${record.month}-${record.day} ${retry}`);
        await execute(record.insertStatement);
        break;
      } catch (error) {
        console.error(error);
        await new Promise(resolve => setTimeout(resolve, retry * 1500));
        continue;
      }
    }
  }

  // await execute(`
  //   RENAME TABLE
  //     default.operations_daily TO default.operations_daily_old,
  //     default.operations_daily_new TO default.operations_daily
  // `);

  // await execute(`
  //   RENAME TABLE
  //     default.operations_hourly TO default.operations_hourly_old,
  //     default.operations_hourly_new TO default.operations_hourly
  // `);

  // await Promise.all([
  //   execute(`DROP VIEW default.operations_daily_old`),
  //   execute(`DROP VIEW default.operations_hourly_old`),
  //   execute(`DROP VIEW default.operations_migration`),
  // ]);
}

main();
