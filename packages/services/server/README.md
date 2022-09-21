# `@hive/server`

The GraphQL API for GraphQL Hive.

## Configuration

| Name                         | Required | Description                                                                           | Example Value                                        |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                       | **Yes**  | The port this service is running on.                                                  | `4013`                                               |
| `SUPERTOKENS_CONNECTION_URI` | **Yes**  | The URI of the SuperTokens instance.                                                  | `http://127.0.0.1:3567`                              |
| `SUPERTOKENS_API_KEY`        | **Yes**  | The API KEY of the SuperTokens instance.                                              | `iliketurtlesandicannotlie`                          |
| `POSTGRES_HOST`              | **Yes**  | Host of the postgres database                                                         | `127.0.0.1`                                          |
| `POSTGRES_PORT`              | **Yes**  | Port of the postgres database                                                         | `5432`                                               |
| `POSTGRES_DB`                | **Yes**  | Name of the postgres database.                                                        | `registry`                                           |
| `POSTGRES_USER`              | **Yes**  | User name for accessing the postgres database.                                        | `postgres`                                           |
| `POSTGRES_PASSWORD`          | **Yes**  | Password for accessing the postgres database.                                         | `postgres`                                           |
| `REDIS_HOST`                 | **Yes**  | The host of your redis instance.                                                      | `"127.0.0.1"`                                        |
| `REDIS_PORT`                 | **Yes**  | The port of your redis instance.                                                      | `6379`                                               |
| `REDIS_PASSWORD`             | **Yes**  | The password of your redis instance.                                                  | `"apollorocks"`                                      |
| `TOKENS_ENDPOINT`            | **Yes**  | The endpoint of the tokens service.                                                   | `http://127.0.0.1:6001`                              |
| `SCHEMA_ENDPOINT`            | **Yes**  | The endpoint of the schema service.                                                   | `http://127.0.0.1:6500`                              |
| `USAGE_ESTIMATOR_ENDPOINT`   | **Yes**  | The endpoint of the usage estimator service.                                          | `4011`                                               |
| `RATE_LIMIT_ENDPOINT`        | **Yes**  | The endpoint of the rate limiting service.                                            | `http://127.0.0.1:4012`                              |
| `EMAILS_ENDPOINT`            | **Yes**  | The endpoint of the GraphQL Hive Email service.                                       | `http://127.0.0.1:6260`                              |
| `ENVIRONMENT`                | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `SENTRY_DSN`                 | No       | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`             | No       | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |

## Hive Hosted Configuration

TODO

### Legacy Auth0 Configuration

If you are not self-hosting GraphQL Hive, you can ignore this section. It is only required for the legacy Auth0 compatibility layer.

| Name                                 | Required                                   | Description                                 | Example Value                   |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------- | ------------------------------- |
| `AUTH_LEGACY_AUTH0`                  | No                                         | Whether the legacy Auth0 import is enabled. | `1` (enabled) or `0` (disabled) |
| `AUTH_LEGACY_AUTH0_INTERNAL_API_KEY` | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The internal endpoint key.                  | `iliketurtles`                  |

## How to disable billing?

Remove the `BILLING_ENDPOINT` from `.env` and `.env.template`.
