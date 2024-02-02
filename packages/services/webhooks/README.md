# `@hive/webhooks`

This service takes care of delivering WebHooks.

## Configuration

| Name                                | Required | Description                                                                                              | Example Value                                        |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                              | **Yes**  | The port on which this service runs.                                                                     | `6250`                                               |
| `REDIS_HOST`                        | **Yes**  | The host of your redis instance.                                                                         | `"127.0.0.1"`                                        |
| `REDIS_PORT`                        | **Yes**  | The port of your redis instance.                                                                         | `6379`                                               |
| `REDIS_PASSWORD`                    | **Yes**  | The password of your redis instance.                                                                     | `"apollorocks"`                                      |
| `ENVIRONMENT`                       | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                    | `staging`                                            |
| `HEARTBEAT_ENDPOINT`                | No       | The endpoint for a heartbeat.                                                                            | `http://127.0.0.1:6969/heartbeat`                    |
| `SENTRY`                            | No       | Whether Sentry error reporting should be enabled.                                                        | `1` (enabled) or `0` (disabled)                      |
| `SENTRY_DSN`                        | No       | The DSN for reporting errors to Sentry.                                                                  | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `PROMETHEUS_METRICS`                | No       | Whether Prometheus metrics should be enabled                                                             | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS_LABEL_INSTANCE` | No       | The instance label added for the prometheus metrics.                                                     | `webhooks-service`                                   |
| `PROMETHEUS_METRICS_PORT`           | No       | Port on which prometheus metrics are exposed                                                             | Defaults to `10254`                                  |
| `REQUEST_BROKER`                    | No       | Whether Request Broker should be enabled.                                                                | `1` (enabled) or `0` (disabled)                      |
| `REQUEST_BROKER_ENDPOINT`           | No       | The address                                                                                              | `https://broker.worker.dev`                          |
| `REQUEST_BROKER_SIGNATURE`          | No       | A secret signature needed to verify the request origin                                                   | `hbsahdbzxch123`                                     |
| `REQUEST_LOGGING`                   | No       | Log http requests                                                                                        | `1` (enabled) or `0` (disabled)                      |
| `LOG_LEVEL`                         | No       | The verbosity of the service logs. One of `trace`, `debug`, `info`, `warn` ,`error`, `fatal` or `silent` | `info` (default)                                     |
