# `@hive/paddle-billing`

Optional service for billing customers with Paddle.

## Configuration

| Name                | Required | Description                                                                                              | Example Value                                        |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`              | **Yes**  | The port this service is running on.                                                                     | `4019`                                               |
| `POSTGRES_PORT`     | **Yes**  | Port of the postgres database                                                                            | `5432`                                               |
| `POSTGRES_DB`       | **Yes**  | Name of the postgres database.                                                                           | `registry`                                           |
| `POSTGRES_USER`     | **Yes**  | User name for accessing the postgres database.                                                           | `postgres`                                           |
| `POSTGRES_PASSWORD` | **Yes**  | Password for accessing the postgres database.                                                            | `postgres`                                           |
| `POSTGRES_SSL`      | No       | Whether the postgres connection should be established via SSL.                                           | `1` (enabled) or `0` (disabled)                      |
| `ENVIRONMENT`       | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                    | `staging`                                            |
| `SENTRY`            | No       | Whether Sentry error reporting should be enabled.                                                        | `1` (enabled) or `0` (disabled)                      |
| `SENTRY_DSN`        | No       | The DSN for reporting errors to Sentry.                                                                  | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `REQUEST_LOGGING`   | No       | Log http requests                                                                                        | `1` (enabled) or `0` (disabled)                      |
| `LOG_LEVEL`         | No       | The verbosity of the service logs. One of `trace`, `debug`, `info`, `warn` ,`error`, `fatal` or `silent` | `info` (default)                                     |
