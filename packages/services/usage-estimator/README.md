# `@hive/usage-estimator`

This service takes care of estimating the usage of an account.

## Configuration

| Name                                | Required | Description                                                                                              | Example Value                                        |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `CLICKHOUSE_PROTOCOL`               | **Yes**  | The clickhouse protocol for connecting to the clickhouse instance.                                       | `http`                                               |
| `CLICKHOUSE_HOST`                   | **Yes**  | The host of the clickhouse instance.                                                                     | `127.0.0.1`                                          |
| `CLICKHOUSE_PORT`                   | **Yes**  | The port of the clickhouse instance                                                                      | `8123`                                               |
| `CLICKHOUSE_USERNAME`               | **Yes**  | The username for accessing the clickhouse instance.                                                      | `test`                                               |
| `CLICKHOUSE_PASSWORD`               | **Yes**  | The password for accessing the clickhouse instance.                                                      | `test`                                               |
| `PORT`                              | **Yes**  | The port this service is running on.                                                                     | `4011`                                               |
| `POSTGRES_HOST`                     | **Yes**  | Host of the postgres database                                                                            | `127.0.0.1`                                          |
| `POSTGRES_PORT`                     | **Yes**  | Port of the postgres database                                                                            | `5432`                                               |
| `POSTGRES_DB`                       | **Yes**  | Name of the postgres database.                                                                           | `registry`                                           |
| `POSTGRES_USER`                     | **Yes**  | User name for accessing the postgres database.                                                           | `postgres`                                           |
| `POSTGRES_PASSWORD`                 | **Yes**  | Password for accessing the postgres database.                                                            | `postgres`                                           |
| `ENVIRONMENT`                       | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                    | `staging`                                            |
| `SENTRY_DSN`                        | No       | The DSN for reporting errors to Sentry.                                                                  | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`                    | No       | Whether Sentry error reporting should be enabled.                                                        | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS`                | No       | Whether Prometheus metrics should be enabled                                                             | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS_LABEL_INSTANCE` | No       | The instance label added for the prometheus metrics.                                                     | `rate-limit`                                         |
| `REQUEST_LOGGING`                   | No       | Log http requests                                                                                        | `1` (enabled) or `0` (disabled)                      |
| `LOG_LEVEL`                         | No       | The verbosity of the service logs. One of `trace`, `debug`, `info`, `warn` ,`error`, `fatal` or `silent` | `info` (default)                                     |
