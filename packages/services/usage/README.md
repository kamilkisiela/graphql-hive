# `@hive/usage`

This service takes care of handling HTTP requests for usage reporting.

The data is written to a Kafka broker, form Kafka the data is feed into clickhouse via the
`usage-ingestor` service.

## Configuration

| Name                                | Required | Description                                                                                                                                          | Example Value                                        |
| ----------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                              | No       | The port this service is running on.                                                                                                                 | `4001`                                               |
| `TOKENS_ENDPOINT`                   | **Yes**  | The endpoint of the tokens service.                                                                                                                  | `http://127.0.0.1:6001`                              |
| `RATE_LIMIT_ENDPOINT`               | No       | The endpoint of the rate limiting service.                                                                                                           | `http://127.0.0.1:4012`                              |
| `KAFKA_TOPIC`                       | **Yes**  | The kafka topic.                                                                                                                                     | `usage_reports_v2`                                   |
| `KAFKA_CONSUMER_GROUP`              | **Yes**  | The kafka consumer group.                                                                                                                            | `usage_reports_v2`                                   |
| `KAFKA_BROKER`                      | **Yes**  | The address of the Kafka broker.                                                                                                                     | `127.0.0.1:29092`                                    |
| `KAFKA_SSL`                         | No       | Whether an SSL connection should be established to the kafka service.                                                                                | `1` (enabled) or `0` (disabled)                      |
| `KAFKA_SSL_CA_PATH`                 | No       | Refer to [TLS create secure context](https://nodejs.org/dist/latest-v8.x/docs/api/tls.html#tls_tls_createsecurecontext_options) for more information | `./path_to_ca`                                       |
| `KAFKA_SSL_CERT_PATH`               | No       | Refer to [TLS create secure context](https://nodejs.org/dist/latest-v8.x/docs/api/tls.html#tls_tls_createsecurecontext_options) for more information | `./path_to_cert`                                     |
| `KAFKA_SSL_KEY_PATH`                | No       | Refer to [TLS create secure context](https://nodejs.org/dist/latest-v8.x/docs/api/tls.html#tls_tls_createsecurecontext_options) for more information | `./path_to_key`                                      |
| `KAFKA_SASL_MECHANISM`              | No       | The mechanism used for doing SASL authentication                                                                                                     | `plain` or `scram-sha-256` or `scram-sha-512`        |
| `KAFKA_SASL_USERNAME`               | No       | The username for the SASL authentication                                                                                                             | `letmein`                                            |
| `KAFKA_SASL_PASSWORD`               | No       | Whether an SSL connection should be established to the kafka service.                                                                                | `letmein`                                            |
| `KAFKA_BUFFER_SIZE`                 | No       | The buffer size ???                                                                                                                                  | `12`                                                 |
| `KAFKA_BUFFER_INTERVAL`             | No       | The buffer interval ???                                                                                                                              | `1`                                                  |
| `KAFKA_BUFFER_DYNAMIC`              | No       | The buffer interval ???                                                                                                                              | `1`                                                  |
| `ENVIRONMENT`                       | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)                                                                | `staging`                                            |
| `SENTRY_DSN`                        | No       | The DSN for reporting errors to Sentry.                                                                                                              | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY`                            | No       | Whether Sentry error reporting should be enabled.                                                                                                    | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS`                | No       | Whether Prometheus metrics should be enabled                                                                                                         | `1` (enabled) or `0` (disabled)                      |
| `PROMETHEUS_METRICS_LABEL_INSTANCE` | No       | The instance label added for the prometheus metrics.                                                                                                 | `usage-service`                                      |
| `REQUEST_LOGGING`                   | No       | Log http requests                                                                                                                                    | `1` (enabled) or `0` (disabled)                      |
