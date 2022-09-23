# `@hive/usage-ingestor`

This service takes care of feeding usage data into the ClickHouse instance.

## Configuration

| Name                   | Required | Description                                                                           | Example Value                                        |
| ---------------------- | -------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `KAFKA_BROKER`         | **Yes**  | The address of the Kafka broker.                                                      | `127.0.0.1:29092`                                    |
| `KAFKA_SSL`            | No       | Whether an SSL connection should be established to the kafka service.                 | `1` (enabled) or `0` (disabled)                      |
| `KAFKA_SASL_MECHANISM` | No       | The mechanism used for doing SASL authentication                                      | `plain` or `scram-sha-256` or `scram-sha-512`        |
| `KAFKA_SASL_USERNAME`  | No       | The username for the SASL authentication                                              | `letmein`                                            |
| `KAFKA_SASL_PASSWORD`  | No       | Whether an SSL connection should be established to the kafka service.                 | `letmein`                                            |
| TODO: clockhouse       | TODO     | TODO                                                                                  | TODO                                                 |
| `ENVIRONMENT`          | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.) | `staging`                                            |
| `SENTRY_DSN`           | No       | The DSN for reporting errors to Sentry.                                               | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`       | No       | Whether Sentry error reporting should be enabled.                                     | `1` (enabled) or `0` (disabled)                      |
