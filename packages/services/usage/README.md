# `@hive/usage`

This service takes care of ????

## Configuration

| Name                  | Required | Description                                                                           | Example Value                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `TOKENS_ENDPOINT`     | **Yes**  | The endpoint of the tokens service.                                                   | `http://127.0.0.1:6001`                              |
| `PORT`                | **Yes**  | The port this service is running on.                                                  | `4001`                                               |
| TODO: Kafka stuff     | **Yes**  | TODO                                                                                  | TODO                                                 |
| `RATE_LIMIT_ENDPOINT` | **Yes**  | The endpoint of the rate limiting service.                                            | `http://127.0.0.1:4012`                              |
| `ENVIRONMENT`         | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `SENTRY_DSN`          | No       | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`      | No       | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |
