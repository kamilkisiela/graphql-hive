# `@hive/storage`

Service for running postgres and clickhouse database migrations.

## Configuration

| Name                    | Required | Description                                                                           | Example Value                                        |
| ----------------------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| TODO: pg and clickhouse | **Yes**  | TODO                                                                                  | TODO                                                 |
| `ENVIRONMENT`           | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `SENTRY_DSN`            | No       | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`        | No       | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |
