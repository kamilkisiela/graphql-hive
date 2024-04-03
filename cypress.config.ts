// eslint-disable-next-line import/no-extraneous-dependencies -- cypress SHOULD be a dev dependency
import fs from 'node:fs';
import { defineConfig } from 'cypress';
// eslint-disable-next-line import/no-extraneous-dependencies
import pg from 'pg';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  video: isCI,
  screenshotOnRunFailure: isCI,
  defaultCommandTimeout: 15_000, // sometimes the app takes longer to load, especially in the CI
  retries: 2,
  env: {
    POSTGRES_URL: 'postgresql://postgres:postgres@localhost:5432/registry',
  },
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        async connectDB(query: string) {
          const dbUrl = new URL(config.env.POSTGRES_URL);
          const client = new pg.Client({
            user: dbUrl.username,
            password: dbUrl.password,
            host: dbUrl.hostname,
            database: dbUrl.pathname.slice(1),
            port: Number(dbUrl.port),
            ssl: false,
          });
          await client.connect();
          const res = await client.query(query);
          await client.end();
          return res.rows;
        },
      });

      on('after:spec', (_, results) => {
        if (results && results.video) {
          // Do we have failures for any retry attempts?
          const failures = results.tests.some(test =>
            test.attempts.some(attempt => attempt.state === 'failed'),
          );
          if (!failures) {
            // delete the video if the spec passed and no tests retried
            fs.unlinkSync(results.video);
          }
        }
      });
    },
  },
});
