# `@hive/stripe-billing`

Optional service for billing customers with Stripe.

## Configuration

| Name                       | Required | Description                                                                                              | Example Value                                         |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `PORT`                     | **Yes**  | The port this service is running on.                                                                     | `4013`                                                |
| `USAGE_ESTIMATOR_ENDPOINT` | **Yes**  | The endpoint of the usage estimator service.                                                             | `4011`                                                |
| `POSTGRES_HOST`            | **Yes**  | Host of the postgres database                                                                            | `127.0.0.1`                                           |
| `POSTGRES_PORT`            | **Yes**  | Port of the postgres database                                                                            | `5432`                                                |
| `POSTGRES_DB`              | **Yes**  | Name of the postgres database.                                                                           | `registry`                                            |
| `POSTGRES_USER`            | **Yes**  | User name for accessing the postgres database.                                                           | `postgres`                                            |
| `POSTGRES_PASSWORD`        | **Yes**  | Password for accessing the postgres database.                                                            | `postgres`                                            |
| `POSTGRES_SSL`             | No       | Whether the postgres connection should be established via SSL.                                           | `1` (enabled) or `0` (disabled)                       |
| `STRIPE_SECRET_KEY`        | **Yes**  | The stripe secret key.                                                                                   | `sk_test_128937812738123789ashjkdnaskmdnj12kehjkqhnw` |
| `STRIPE_SYNC_INTERVAL_MS`  | No       | The stripe sync interval in milliseconds (Default: `600_000`)                                            | `1_000`                                               |
| `ENVIRONMENT`              | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                    | `staging`                                             |
| `SENTRY`                   | No       | Whether Sentry error reporting should be enabled.                                                        | `1` (enabled) or `0` (disabled)                       |
| `SENTRY_DSN`               | No       | The DSN for reporting errors to Sentry.                                                                  | `https://dooobars@o557896.ingest.sentry.io/12121212`  |
| `REQUEST_LOGGING`          | No       | Log http requests                                                                                        | `1` (enabled) or `0` (disabled)                       |
| `LOG_LEVEL`                | No       | The verbosity of the service logs. One of `trace`, `debug`, `info`, `warn` ,`error`, `fatal` or `silent` | `info` (default)                                      |
