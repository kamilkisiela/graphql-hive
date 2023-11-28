# `@hive/policy`

Service for running [GraphQL-ESLint](https://github.com/B2o5T/graphql-eslint) as part of Hive schema
policy checks.

## Configuration

| Name                                | Required | Description                                                                                              | Example Value                                        |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                              | No       | The port this service is running on.                                                                     | `6600`                                               |
| `LOG_LEVEL`                         | No       | The verbosity of the service logs. One of `trace`, `debug`, `info`, `warn` ,`error`, `fatal` or `silent` | `info` (default)                                     |
| `ENVIRONMENT`                       | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                    | `staging`                                            |
| `SENTRY_DSN`                        | No       | The DSN for reporting errors to Sentry.                                                                  | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY`                            | No       | Whether Sentry error reporting should be enabled.                                                        | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS`                | No       | Whether Prometheus metrics should be enabled                                                             | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS_LABEL_INSTANCE` | No       | The instance label added for the prometheus metrics.                                                     | `usage-service`                                      |
