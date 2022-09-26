# `@hive/tokens`

This service takes care of validating and issuing tokens used for accessing the public facing hive APIs (usage service and GraphQL API).

## Configuration

| Name                  | Required | Description                                                                           | Example Value                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                | **Yes**  | The port this service is running on.                                                  | `6001`                                               |
| `POSTGRES_HOST`       | **Yes**  | Host of the postgres database                                                         | `127.0.0.1`                                          |
| `POSTGRES_PORT`       | **Yes**  | Port of the postgres database                                                         | `5432`                                               |
| `POSTGRES_DB`         | **Yes**  | Name of the postgres database.                                                        | `registry`                                           |
| `POSTGRES_USER`       | **Yes**  | User name for accessing the postgres database.                                        | `postgres`                                           |
| `POSTGRES_PASSWORD`   | **Yes**  | Password for accessing the postgres database.                                         | `postgres`                                           |
| `POSTGRES_SSL`        | No       | Whether the postgres connection should be established via SSL.                        | `1` (enabled) or `0` (disabled)                      |
| `RATE_LIMIT_ENDPOINT` | **Yes**  | The endpoint of the rate limiting service.                                            | `http://127.0.0.1:4012`                              |
| `ENVIRONMENT`         | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `SENTRY`              | No       | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |
| `SENTRY_DSN`          | No       | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
