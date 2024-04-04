import got from 'got';
import pLimit from 'p-limit';
import { createPool, sql } from 'slonik';
import z from 'zod';
import { createConnectionString } from '../connection-string.js';
import { env } from './environment.js';

const SuccessfulClickHouseResponse = z.object({
  rows: z.number(),
});

const FailedClickHouseResponse = z.object({
  exception: z.string().optional(),
});

const CurrentMonthOperationsResponse = z.union([
  SuccessfulClickHouseResponse.extend({
    data: z.array(
      z.object({
        total: z.number(),
      }),
    ),
  }),
  FailedClickHouseResponse,
]);

const PreviousMonthsResponse = z.union([
  SuccessfulClickHouseResponse.extend({
    data: z.array(
      z.object({
        total: z.number(),
        date: z.string(),
      }),
    ),
  }),
  FailedClickHouseResponse,
]);

const MigrationRequirements = z.object({
  CLICKHOUSE_MIGRATION_006_DATE: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
});

async function main() {
  if (env.clickhouse === null) {
    throw new Error('WTF');
  }

  const { clickhouse, postgres } = env;
  const poolSize = 5;
  const limit = pLimit(poolSize);

  const slonik = await createPool(createConnectionString(postgres), {
    // 30 seconds timeout per statement
    statementTimeout: 30 * 1000,
    maximumPoolSize: poolSize,
  });

  // eslint-disable-next-line no-process-env
  const { CLICKHOUSE_MIGRATION_006_DATE } = MigrationRequirements.parse(process.env);

  const endpoint = `${clickhouse.protocol}://${clickhouse.host}:${clickhouse.port}`;

  function execute(
    query: string,
    options?: {
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
          Accept: 'application/json',
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

  function fetchOrganizations() {
    return slonik.manyFirst<string>(sql`SELECT id FROM organizations`);
  }

  function fetchTargets(organizationId: string) {
    return slonik.manyFirst<string>(sql`
      SELECT array_agg(o.id) as targets
      FROM organizations AS o
      LEFT JOIN projects AS p ON (p.org_id = o.id)
      LEFT JOIN targets as t ON (t.project_id = p.id)
      WHERE o.id = ${organizationId}
      GROUP BY o.id
    `);
  }

  async function migrateOrganization(organizationId: string): Promise<void> {
    const targets = await fetchTargets(organizationId);

    if (targets.length === 0) {
      console.log(`No targets found for organization ${organizationId}`);
      return;
    }

    const targetIdsArray = targets.map(target => `'${target}'`).join(', ');

    // increase the amount of operations of the current month (from start of the month to 00:00:00 of CLICKHOUSE_MIGRATION_006_DATE)
    const currentMonthResponse = await execute(
      `
        SELECT sum(total) as total FROM operations_daily
        WHERE 
          target IN (${targetIdsArray})
          AND toDate(timestamp) >= toDate(toStartOfMonth(toDate('${CLICKHOUSE_MIGRATION_006_DATE}')))
          AND toDate(timestamp) < toDate('${CLICKHOUSE_MIGRATION_006_DATE}')
      `,
    ).catch(error => {
      console.error(`Failed to fetch current month operations for organization ${organizationId}`);
      return Promise.reject(error);
    });

    const currentMonth = CurrentMonthOperationsResponse.safeParse(
      JSON.parse(currentMonthResponse.body),
    );

    if (!currentMonth.success) {
      console.error(currentMonth.error);
      throw new Error(
        `Failed to parse current month operations response for organization ${organizationId}`,
      );
    }

    if ('exception' in currentMonth.data) {
      console.error(currentMonth.data.exception);
      throw new Error(
        `Failed to fetch current month operations for organization ${organizationId}`,
      );
    }

    if (!('rows' in currentMonth.data)) {
      throw new Error(
        `No "rows" property in the current month response for organization ${organizationId}`,
      );
    }

    if (!currentMonth.data.data.length) {
      console.log(`No operations from current month found for organization ${organizationId}`);
      return;
    }

    if (currentMonth.data.data.length > 1) {
      throw new Error(`Oh no! We got too many rows for organization ${organizationId}`);
    }

    const currentMonthMissingTotal = currentMonth.data.data[0].total;

    // update the monthly_overview table with the new total
    await execute(`
      INSERT INTO monthly_overview
      (organization, date, total)
      VALUES
      ('${organizationId}', toDate(toStartOfMonth(toDate('${CLICKHOUSE_MIGRATION_006_DATE}')), ${currentMonthMissingTotal})
    `);

    // insert data from the previous months
    const previousMonthsResponse = await execute(
      `
        SELECT
          sum(total) as total,
          toDate(toStartOfMonth(timestamp)) as date
        FROM operations_daily
        WHERE 
          target IN (${targetIdsArray})
          AND toDate(timestamp) < toDate(toStartOfMonth(toDate('${CLICKHOUSE_MIGRATION_006_DATE}')))
        GROUP BY date
      `,
    ).catch(error => {
      console.error(`Failed to fetch previous months for organization ${organizationId}`);
      return Promise.reject(error);
    });

    const previousMonths = PreviousMonthsResponse.safeParse(
      JSON.parse(previousMonthsResponse.body),
    );

    if (!previousMonths.success) {
      console.error(previousMonths.error);
      throw new Error(
        `Failed to parse previous months response for organization ${organizationId}`,
      );
    }

    if ('exception' in previousMonths.data) {
      console.error(previousMonths.data.exception);
      throw new Error(`Failed to fetch previous months for organization ${organizationId}`);
    }

    if (!('rows' in previousMonths.data)) {
      throw new Error(
        `No "rows" property in the previous months response for organization ${organizationId}`,
      );
    }

    if (!previousMonths.data.data.length) {
      console.log(`No operations from previous month found for organization ${organizationId}`);
      return;
    }

    // insert data from the previous months
    await execute(`
      INSERT INTO monthly_overview
      (organization, date, total)
      VALUES
      ${previousMonths.data.data
        .map(row => `('${organizationId}', toDate('${row.date}'), ${row.total})`)
        .join(', ')}
    `);
  }

  const organizations = await fetchOrganizations();

  await Promise.all(
    organizations.map(organizationId =>
      limit(() =>
        migrateOrganization(organizationId).catch(error => {
          console.error(error);
          console.error(`ERR: Failed to migrate organization ${organizationId}`);
          return Promise.resolve();
        }),
      ),
    ),
  );
}

main();
