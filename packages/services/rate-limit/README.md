# Rate Limit

The rate limit service is responsible of enforcing account limitations.

## Configuration

| Name                       | Required                                           | Description                                     | Example Value           |
| -------------------------- | -------------------------------------------------- | ----------------------------------------------- | ----------------------- |
| `PORT`                     | **Yes**                                            | The HTTP port of the service.                   | `4012`                  |
| `POSTGRES_HOST`            | **Yes**                                            | Host of the postgres database                   | `127.0.0.1`             |
| `POSTGRES_PORT`            | **Yes**                                            | Port of the postgres database                   | `5432`                  |
| `POSTGRES_DB`              | **Yes**                                            | Name of the postgres database.                  | `registry`              |
| `POSTGRES_USER`            | **Yes**                                            | User name for accessing the postgres database.  | `postgres`              |
| `POSTGRES_PASSWORD`        | **Yes**                                            | Password for accessing the postgres database.   | `postgres`              |
| `USAGE_ESTIMATOR_ENDPOINT` | **Yes**                                            | The endpoint of the usage estimator service.    | `http://127.0.0.1:4011` |
| `EMAILS_ENDPOINT`          | No (if not provided no limit emails will be sent.) | The endpoint of the GraphQL Hive Email service. | `http://127.0.0.1:6260` |
