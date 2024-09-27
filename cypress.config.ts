import fs from 'node:fs';
// eslint-disable-next-line import/no-extraneous-dependencies -- cypress SHOULD be a dev dependency
import { defineConfig } from 'cypress';
// eslint-disable-next-line import/no-extraneous-dependencies
import pg from 'pg';

const isCI = Boolean(process.env.CI);

export type Token = {
  sAccessToken: string;
  sFrontToken: string;
  sRefreshToken: string;
};

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
      async function connectDB(query: string) {
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
      }

      on('task', {
        connectDB,
        async deleteUser(email = 'test@test.com') {
          const [user] = await connectDB(`SELECT *
                                          FROM users
                                          WHERE email = '${email}';`);
          if (user) {
            await connectDB(`
BEGIN;

DELETE FROM organizations WHERE user_id = '${user.id}';
DELETE FROM users WHERE id = '${user.id}';
DELETE FROM supertokens_emailpassword_user_to_tenant WHERE email = '${email}';

COMMIT;          
`);
          }

          return true;
        },
        async createUser({
          email = 'test@test.com',
          password = 'qwerty123',
          firstName = 'Dima',
          lastName = 'Test',
        }: {
          email?: string;
          password?: string;
          firstName?: string;
          lastName?: string;
        } = {}) {
          const response = await fetch('http://localhost:3001/auth-api/signup', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              formFields: [
                { id: 'email', value: email },
                { id: 'password', value: password },
                { id: 'firstName', value: firstName },
                { id: 'lastName', value: lastName },
              ],
            }),
          });
          const data = await response.json();
          if (response.status !== 200 || data.status === 'FIELD_ERROR') {
            throw new Error(
              `${response.status}: ${response.statusText}\n\n${JSON.stringify(data, null, 2)}`,
            );
          }
          const result: Token = {
            sAccessToken: response.headers.get('st-access-token')!,
            sFrontToken: response.headers.get('front-token')!,
            sRefreshToken: response.headers.get('st-refresh-token')!,
          };
          return result;
        },
        async login() {
          const response = await fetch('http://localhost:3001/auth-api/signin', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              formFields: [
                { id: 'email', value: 'test@test.com' },
                { id: 'password', value: 'qwerty123' },
              ],
            }),
          });
          const data = await response.json();
          if (response.status !== 200) {
            throw new Error(
              `${response.status}: ${response.statusText}\n\n${JSON.stringify(data, null, 2)}`,
            );
          }

          const result: Token = {
            sAccessToken: response.headers.get('st-access-token')!,
            sFrontToken: response.headers.get('front-token')!,
            sRefreshToken: response.headers.get('st-refresh-token')!,
          };
          return result;
        },
        async createOrganization(token) {
          const response = await fetch('http://localhost:3001/graphql', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              operationName: 'CreateOrganizationMutation',
              variables: { input: { name: 'Foo' } },
              query: /* GraphQL */ `
                mutation CreateOrganizationMutation($input: CreateOrganizationInput!) {
                  createOrganization(input: $input) {
                    ok {
                      createdOrganizationPayload {
                        organization {
                          id
                          cleanId
                        }
                      }
                    }
                  }
                }
              `,
            }),
          });
          const { data, errors = [] } = await response.json();
          if (!data || errors.length) {
            throw new Error((errors as Error[]).map(error => error.message).join('\n'));
          }
          return data;
        },
        async createProject(token) {
          const response = await fetch('http://localhost:3001/graphql', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              operationName: 'CreateProject',
              query: /* GraphQL */ `
                mutation CreateProject($input: CreateProjectInput!) {
                  createProject(input: $input) {
                    ok {
                      createdProject {
                        id
                        name
                        cleanId
                      }
                    }
                  }
                }
              `,
              variables: {
                input: {
                  name: 'My new Project',
                  organization: 'foo',
                  type: 'SINGLE',
                },
              },
            }),
          });
          const { data, errors = [] } = await response.json();
          if (!data || errors.length) {
            throw new Error((errors as Error[]).map(error => error.message).join('\n'));
          }
          return data;
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
