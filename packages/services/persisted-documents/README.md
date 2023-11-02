# `@hive/persisted-documents`

Service for running background jobs related to persisted documents.

- **Active a deployment.** Write persisted documents to S3
- **Disable a deployment.** Remove persisted documents from S3

## Configuration

| Name                   | Required | Description                                                          | Example Value                   |
| ---------------------- | -------- | -------------------------------------------------------------------- | ------------------------------- |
| `PORT`                 | **Yes**  | The port this service is running on.                                 | `6270`                          |
| `REDIS_HOST`           | **Yes**  | The host of your redis instance.                                     | `"127.0.0.1"`                   |
| `REDIS_PORT`           | **Yes**  | The port of your redis instance.                                     | `6379`                          |
| `REDIS_PASSWORD`       | **Yes**  | The password of your redis instance.                                 | `"apollorocks"`                 |
| `S3_ENDPOINT`          | **Yes**  | The S3 endpoint.                                                     | `http://localhost:9000`         |
| `S3_ACCESS_KEY_ID`     | **Yes**  | The S3 access key id.                                                | `minioadmin`                    |
| `S3_SECRET_ACCESS_KEY` | **Yes**  | The S3 secret access key.                                            | `minioadmin`                    |
| `S3_BUCKET_NAME`       | **Yes**  | The S3 bucket name.                                                  | `artifacts`                     |
| `S3_SESSION_TOKEN`     | No       | The S3 session token.                                                | `dummytoken`                    |
| `S3_PUBLIC_URL`        | No       | The public URL of the S3, in case it differs from the `S3_ENDPOINT`. | `http://localhost:8083`         |
| `POSTGRES_SSL`         | No       | Whether the postgres connection should be established via SSL.       | `1` (enabled) or `0` (disabled) |
| `POSTGRES_HOST`        | **Yes**  | Host of the postgres database                                        | `127.0.0.1`                     |
| `POSTGRES_PORT`        | **Yes**  | Port of the postgres database                                        | `5432`                          |
| `POSTGRES_DB`          | **Yes**  | Name of the postgres database.                                       | `registry`                      |
| `POSTGRES_USER`        | **Yes**  | User name for accessing the postgres database.                       | `postgres`                      |
| `POSTGRES_PASSWORD`    | **Yes**  | Password for accessing the postgres database.                        | `postgres`                      |
