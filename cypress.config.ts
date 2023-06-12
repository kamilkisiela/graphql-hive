// eslint-disable-next-line import/no-extraneous-dependencies -- cypress SHOULD be a dev dependency
import { defineConfig } from 'cypress';
// eslint-disable-next-line import/no-extraneous-dependencies
import pg from 'pg';

export default defineConfig({
  video: false, // TODO: can it be useful for CI?
  screenshotOnRunFailure: false, // TODO: can it be useful for CI?
  defaultCommandTimeout: 8000, // sometimes the app takes longer to load, especially in the CI
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
    },
  },
});
