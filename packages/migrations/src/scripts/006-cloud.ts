import got from 'got';
import pLimit from 'p-limit';
import { createPool, sql } from 'slonik';
import z from 'zod';
import { createConnectionString } from '../connection-string.js';
import { env } from './environment.js';

function log(...args: any[]) {
  console.log(new Date().toLocaleString(), '| INFO  |', ...args);
}

function logError(...args: any[]) {
  console.error(new Date().toLocaleString(), '| ERROR |', ...args);
}

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
        total: z.string().transform(value => Number(value)),
      }),
    ),
  }),
  FailedClickHouseResponse,
]);

const PreviousMonthsResponse = z.union([
  SuccessfulClickHouseResponse.extend({
    data: z.array(
      z.object({
        total: z.string().transform(value => Number(value)),
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
  const startedAt = Date.now();

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
          'Accept-Encoding': 'gzip',
          Accept: 'application/json',
        },
        decompress: true,
        username: clickhouse.username,
        password: clickhouse.password,
        responseType: 'json',
      })
      .catch(error => {
        const body = error?.response?.body;
        if (body) {
          logError(body);
        }

        return Promise.reject(error);
      });
  }

  function fetchOrganizations() {
    log('Fetching organizations');
    return slonik.manyFirst<string>(sql`SELECT id FROM organizations`);
  }

  function fetchTargets(organizationId: string) {
    log(`Fetching targets for organization ${organizationId}`);
    return slonik.oneFirst<string[]>(sql`
      SELECT array_agg(DISTINCT t.id) as targets
      FROM organizations AS o
      LEFT JOIN projects AS p ON (p.org_id = o.id)
      LEFT JOIN targets as t ON (t.project_id = p.id)
      WHERE o.id = ${organizationId}
      GROUP BY o.id
    `);
  }

  async function migrateOrganization(organizationId: string): Promise<void> {
    const startedAt = Date.now();
    log(`Migrating organization ${organizationId}`);
    const targets = await fetchTargets(organizationId);

    if (targets.length === 0) {
      log(`No targets found for organization ${organizationId}`);
      return;
    }

    const targetIdsArray = `'` + targets.join(`','`) + `'`;

    // increase the amount of operations of the current month (from start of the month to 00:00:00 of CLICKHOUSE_MIGRATION_006_DATE)
    log(`Fetching current month operations for organization ${organizationId}`);
    const currentMonthResponse = await execute(
      `
        SELECT sum(total) as total FROM operations_daily
        WHERE 
          target IN (${targetIdsArray})
          AND toDate(timestamp) >= toDate(toStartOfMonth(toDate('${CLICKHOUSE_MIGRATION_006_DATE}')))
          AND toDate(timestamp) < toDate('${CLICKHOUSE_MIGRATION_006_DATE}')
      `,
    ).catch(error => {
      logError(`Failed to fetch current month operations for organization ${organizationId}`);
      return Promise.reject(error);
    });

    const currentMonth = CurrentMonthOperationsResponse.safeParse(currentMonthResponse.body);

    if (!currentMonth.success) {
      logError(currentMonth.error);
      throw new Error(
        `Failed to parse current month operations response for organization ${organizationId}`,
      );
    }

    if ('exception' in currentMonth.data) {
      logError(currentMonth.data.exception);
      throw new Error(
        `Failed to fetch current month operations for organization ${organizationId}`,
      );
    }

    if (!('data' in currentMonth.data)) {
      throw new Error(
        `No "data" property in the current month response for organization ${organizationId}`,
      );
    }

    if (!currentMonth.data.data.length) {
      log(`No operations from current month found for organization ${organizationId}`);
      return;
    }

    if (currentMonth.data.data.length > 1) {
      throw new Error(`Oh no! We got too many rows for organization ${organizationId}`);
    }

    const currentMonthMissingTotal = currentMonth.data.data[0].total;

    // update the monthly_overview table with the new total
    log(`Updating current month total for organization ${organizationId}`);
    if (currentMonthMissingTotal > 0) {
      await execute(`
        INSERT INTO monthly_overview
        (organization, date, total)
        VALUES
        ('${organizationId}', toDate(toStartOfMonth(toDate('${CLICKHOUSE_MIGRATION_006_DATE}'))), ${currentMonthMissingTotal})
      `);
    } else {
      log('No need, the total number fetched is 0');
    }

    // insert data from the previous months
    log(`Fetching previous months for organization ${organizationId}`);
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
      logError(`Failed to fetch previous months for organization ${organizationId}`);
      return Promise.reject(error);
    });

    const previousMonths = PreviousMonthsResponse.safeParse(previousMonthsResponse.body);

    if (!previousMonths.success) {
      logError(previousMonths.error);
      throw new Error(
        `Failed to parse previous months response for organization ${organizationId}`,
      );
    }

    if ('exception' in previousMonths.data) {
      logError(previousMonths.data.exception);
      throw new Error(`Failed to fetch previous months for organization ${organizationId}`);
    }

    if (!('data' in previousMonths.data)) {
      throw new Error(
        `No "data" property in the previous months response for organization ${organizationId}`,
      );
    }

    if (!previousMonths.data.data.length) {
      log(`No operations from previous month found for organization ${organizationId}`);
      return;
    }

    // insert data from the previous months
    log(`Inserting previous months for organization ${organizationId}`);
    if (previousMonths.data.data.some(row => row.total > 0)) {
      await execute(`
        INSERT INTO monthly_overview
        (organization, date, total)
        VALUES
        ${previousMonths.data.data
          .filter(row => row.total > 0)
          .map(row => `('${organizationId}', toDate('${row.date}'), ${row.total})`)
          .join(', ')}
      `);
    } else {
      log('No need, the total number fetched is 0');
    }

    log(`Migrated organization ${organizationId} in ${Date.now() - startedAt}ms`);
  }

  const organizations = await fetchOrganizations();

  log(`Found ${organizations.length} organizations to migrate`);

  await Promise.all(
    organizations.map(organizationId =>
      limit(() =>
        migrateOrganization(organizationId).catch(error => {
          logError(error);
          logError(`Failed to migrate organization ${organizationId}`);
          return Promise.resolve();
        }),
      ),
    ),
  );

  log(`Finished in ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

main();
