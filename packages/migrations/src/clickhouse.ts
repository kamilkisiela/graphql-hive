import { got } from 'got';
import { z } from 'zod';

const MigrationsTableModel = z.object({
  rows: z.number(),
  data: z.array(
    z.object({
      id: z.number(),
    }),
  ),
});

// eslint-disable-next-line no-process-env
const isGraphQLHiveCloud = process.env.CLICKHOUSE_MIGRATOR_GRAPHQL_HIVE_CLOUD === '1';

interface QueryResponse<T> {
  data: readonly T[];
  rows: number;
  statistics: {
    elapsed: number;
  };
}

export type Action = (
  exec: (query: string, settings?: Record<string, string>) => Promise<void>,
  query: (queryString: string) => Promise<QueryResponse<unknown>>,
  isGraphQLHiveCloud: boolean,
) => Promise<void>;

export async function migrateClickHouse(
  isClickHouseMigrator: boolean,
  clickhouse: {
    protocol: string;
    host: string;
    port: number;
    username: string;
    password: string;
  },
) {
  if (isClickHouseMigrator === false) {
    console.log('Skipping ClickHouse migration');
    return;
  }

  const endpoint = `${clickhouse.protocol}://${clickhouse.host}:${clickhouse.port}`;

  console.log('Migrating ClickHouse');
  console.log('Endpoint:', endpoint);
  console.log('Username:', clickhouse.username);
  console.log('Password:', clickhouse.password.length);

  // Warm up ClickHouse instance.
  // This is needed because ClickHouse takes a while to start up
  // when pausing after a period of inactivity is enabled (which is true for dev and staging)
  await got.get(endpoint, {
    searchParams: {
      query: 'SELECT 1',
      default_format: 'JSON',
      wait_end_of_query: '1',
    },
    timeout: {
      request: 10_000,
    },
    headers: {
      Accept: 'text/plain',
    },
    username: clickhouse.username,
    password: clickhouse.password,
    retry: {
      calculateDelay({ attemptCount }) {
        if (attemptCount > 10) {
          // Stop retrying after 10 attempts
          return 0;
        }

        // Retry after 5 seconds
        return 5_000;
      },
    },
  });

  function exec(query: string, settings?: Record<string, string>) {
    return got
      .post(endpoint, {
        body: query,
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
          ...settings,
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

  function query(queryString: string) {
    return got
      .post<QueryResponse<unknown>>(endpoint, {
        body: queryString,
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
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
          console.error(body);
        }

        return Promise.reject(error);
      })
      .then(r => r.body);
  }

  // Create migrations table
  await exec(`
    CREATE TABLE IF NOT EXISTS default.migrations (
      id UInt8,
      timestamp DateTime('UTC'),
    ) ENGINE = MergeTree()
    ORDER BY (id, timestamp)
  `);

  // Read migrations table
  const migrationsResponse = await exec(`
    SELECT id FROM default.migrations ORDER BY id DESC
  `);

  const completedActions = new Set(
    MigrationsTableModel.parse(JSON.parse(migrationsResponse.body)).data.map(({ id }) => id),
  );

  const actions = await Promise.all<{ action: Action }>([
    import('./clickhouse-actions/001-initial'),
    import('./clickhouse-actions/002-add-hash-to-clients_daily'),
    import('./clickhouse-actions/003-add-client-name-to-operations-tables'),
    import('./clickhouse-actions/004-version-2'),
    import('./clickhouse-actions/005-subscription-conditional-breaking-changes'),
  ]);

  async function actionRunner(action: Action, index: number) {
    const startedAt = Date.now();
    console.log(` - Running action`, index);

    if (completedActions.has(index)) {
      console.log('   Skipping because it was already run');
      return;
    }

    try {
      await action(
        async (query, settings) => {
          await exec(query, settings);
        },
        query,
        isGraphQLHiveCloud,
      );
    } catch (error) {
      console.error(error);
      process.exit(1);
    }

    await exec(`
      INSERT INTO default.migrations (id, timestamp) VALUES (${index}, now())
    `);

    const finishedAt = Date.now();
    console.log(`   Finished in ${finishedAt - startedAt}ms`);
  }

  console.log('');
  console.log('Running ClickHouse migrations');
  console.log('');
  for (const [index, { action }] of actions.entries()) {
    await actionRunner(action, index);
  }

  console.log('');
  console.log('ClickHouse Migration completed');
}
