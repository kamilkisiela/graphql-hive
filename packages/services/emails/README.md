# Emails

Service for sending Hive Emails.

## Configuration

## Configuration

| Name                                     | Required                                              | Description                                                                           | Example Value                                        |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                                   | No                                                    | The port this service is running on.                                                  | `6260`                                               |
| `REDIS_HOST`                             | **Yes**                                               | The host of your redis instance.                                                      | `"127.0.0.1"`                                        |
| `REDIS_PORT`                             | **Yes**                                               | The port of your redis instance.                                                      | `6379`                                               |
| `REDIS_PASSWORD`                         | **Yes**                                               | The password of your redis instance.                                                  | `"apollorocks"`                                      |
| `EMAIL_FROM`                             | **Yes**                                               | The email address used for sending emails                                             | `kamil@graphql-hive.com`                             |
| `EMAIL_PROVIDER`                         | **Yes**                                               | The email provider that should be used for sending emails.                            | `mock` or `postmark`                                 |
| `EMAIL_PROVIDER_POSTMARK_TOKEN`          | No (**Yes** if `EMAIL_PROVIDER` is set to `postmark`) | The postmark token.                                                                   | `abcdefg123`                                         |
| `EMAIL_PROVIDER_POSTMARK_MESSAGE_STREAM` | No (**Yes** if `EMAIL_PROVIDER` is set to `postmark`) | The postmark message stream.                                                          | `abcdefg123`                                         |
| `ENVIRONMENT`                            | No                                                    | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `HEARTBEAT_ENDPOINT`                     | No                                                    | The endpoint for a heartbeat.                                                         | `http://127.0.0.1:6969/heartbeat`                    |
| `SENTRY`                                 | No                                                    | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |
| `SENTRY_DSN`                             | No                                                    | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `PROMETHEUS_METRICS`                     | No                                                    | Whether Prometheus metrics should be enabled                                          | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS_LABEL_INSTANCE`      | No                                                    | The instance label added for the prometheus metrics.                                  | `usage-service`                                      |

Optional service for sending emails.

```bash
EMAIL_PROVIDER="postmark"           # only Postmark is supported
EMAIL_FROM="kamil@graphql-hive.com" # sender email address

# Specific to Postmark
POSTMARK_TOKEN="<required>"
POSTMARK_MESSAGE_STREAM="<required>"
```

Used by services: `rate-limit`.
