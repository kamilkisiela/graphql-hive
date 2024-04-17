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

const FirstDateOfMigrationResponse = z.union([
  SuccessfulClickHouseResponse.extend({
    data: z.array(
      z.object({
        date: z.string(),
      }),
    ),
  }),
  FailedClickHouseResponse,
]);

const OrganizationsResponse = z.union([
  SuccessfulClickHouseResponse.extend({
    data: z.array(
      z.object({
        organization: z.string(),
      }),
    ),
  }),
  FailedClickHouseResponse,
]);

const PastMonthOperationsResponse = z.union([
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

type DataProp<T> = T extends { data: Array<infer R> } ? R[] : never;

function ensureData<
  T extends
    | {
        exception?: string | undefined;
      }
    | {
        rows: number;
        data: unknown[];
      },
>(parsed: z.SafeParseReturnType<unknown, T>, label: string): DataProp<T> {
  if (!parsed.success) {
    logError(parsed.error);
    throw new Error('Failed to parse response of ' + label);
  }

  if ('exception' in parsed.data) {
    logError(parsed.data.exception);
    throw new Error('Failed to fetch date of ' + label);
  }

  if (!('data' in parsed.data)) {
    throw new Error('No "data" property in the response of ' + label);
  }

  return parsed.data.data as DataProp<T>;
}

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

  async function fetchDateOfMigration() {
    const response = await execute('SELECT date FROM daily_overview ORDER BY date ASC LIMIT 1');
    const parsed = FirstDateOfMigrationResponse.safeParse(response.body);

    if (parsed.success) {
      parsed.data;
    }

    const data = ensureData(parsed, 'fetchDateOfMigration');

    if (data.length !== 1) {
      throw new Error('Expected exactly one row in the response of fetchDateOfMigration');
    }

    return data[0].date;
  }

  async function fetchOrganizations() {
    log('Fetching organizations');
    const response = await execute(
      `
        SELECT organization FROM monthly_overview
        WHERE date >= toDate(toStartOfMonth(now() - INTERVAL 2 MONTH))
        GROUP BY organization
      `,
    );

    const parsed = OrganizationsResponse.safeParse(response.body);

    return ensureData(parsed, 'fetchOrganizations').map(row => row.organization);
  }

  async function fetchTargets(organizationId: string) {
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

  async function migrateOrganization(organizationId: string, migrationDate: string): Promise<void> {
    const startedAt = Date.now();
    log(`Migrating organization ${organizationId}`);
    const targets = await fetchTargets(organizationId);

    if (targets.length === 0) {
      log(`No targets found for organization ${organizationId}`);
      return;
    }

    const targetIdsArray = `'` + targets.join(`','`) + `'`;

    // insert the amount of operations from the past 30 days until `migrationDate`
    log(`Fetching past month operations for organization ${organizationId}`);
    const pastMonthResponse = await execute(
      `
        SELECT sum(total) as total, toDate(timestamp) as date FROM operations_daily
        WHERE 
          target IN (${targetIdsArray})
          AND toDate(timestamp) >= (toDate('${migrationDate}') - INTERVAL 1 MONTH)
          AND toDate(timestamp) < toDate('${migrationDate}')
        GROUP BY date
      `,
    ).catch(error => {
      logError(`Failed to fetch past month operations for organization ${organizationId}`);
      return Promise.reject(error);
    });

    const pastMonth = PastMonthOperationsResponse.safeParse(pastMonthResponse.body);

    const data = ensureData(pastMonth, 'fetchPastMonthOperations');

    // update the daily_overview table
    log(`Updating daily_overview for organization ${organizationId}`);
    if (data.length) {
      await execute(`
        INSERT INTO daily_overview
        (organization, date, total)
        VALUES
        ${data.map(row => `('${organizationId}', toDate('${row.date}'), ${row.total})`).join(', ')}
      `);
    } else {
      log('No records');
    }

    log(`Migrated organization ${organizationId} in ${Date.now() - startedAt}ms`);
  }

  const organizations = await fetchOrganizations();

  log(`Found ${organizations.length} organizations to migrate`);

  const migrationDate = await fetchDateOfMigration();
  await Promise.all(
    organizations.map(organizationId =>
      limit(() =>
        migrateOrganization(organizationId, migrationDate).catch(error => {
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
