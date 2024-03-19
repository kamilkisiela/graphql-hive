# `@hive/app`

The Hive application as seen on https://app.graphql-hive.com/.

## Configuration

The following environment variables configure the application.

| Name                                    | Required                                   | Description                                                                                   | Example Value                                        |
| --------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `APP_BASE_URL`                          | **Yes**                                    | The base url of the app,                                                                      | `https://app.graphql-hive.com`                       |
| `GRAPHQL_PUBLIC_ENDPOINT`               | **Yes**                                    | The public endpoint of the Hive GraphQL API.                                                  | `http://127.0.0.1:4000/graphql`                      |
| `GRAPHQL_PUBLIC_ORIGIN`                 | **Yes**                                    | The http address origin of the Hive GraphQL server.                                           | `http://127.0.0.1:4000/`                             |
| `INTEGRATION_SLACK`                     | No                                         | Whether the Slack integration is enabled or disabled.                                         | `1` (enabled) or `0` (disabled)                      |
| `INTEGRATION_SLACK_SLACK_CLIENT_ID`     | No (**Yes** if `INTEGRATION_SLACK` is set) | The Slack client ID.                                                                          | `g6aff8102efda5e1d12e`                               |
| `INTEGRATION_SLACK_SLACK_CLIENT_SECRET` | No (**Yes** if `INTEGRATION_SLACK` is set) | The Slack client secret.                                                                      | `g12e552xx54xx2b127821dc4abc4491dxxxa6b187`          |
| `INTEGRATION_GITHUB_APP_NAME`           | No                                         | The GitHub application name.                                                                  | `graphql-hive-self-hosted`                           |
| `AUTH_GITHUB`                           | No                                         | Whether login via GitHub should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_GOOGLE`                           | No                                         | Whether login via Google should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_ORGANIZATION_OIDC`                | No                                         | Whether linking a Hive organization to an Open ID Connect provider is allowed. (Default: `0`) | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA`                             | No                                         | Whether login via Okta should be allowed                                                      | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA_HIDDEN`                      | No                                         | Whether the Okta login button should be hidden. (Default: `0`)                                | `1` (enabled) or `0` (disabled)                      |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`       | No                                         | Whether verifying the email address is mandatory.                                             | `1` (enabled) or `0` (disabled)                      |
| `ENVIRONMENT`                           | No                                         | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)         | `staging`                                            |
| `SENTRY_DSN`                            | No                                         | The DSN for reporting errors to Sentry.                                                       | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`                        | No                                         | Whether Sentry error reporting should be enabled.                                             | `1` (enabled) or `0` (disabled)                      |
| `DOCS_URL`                              | No                                         | The URL of the Hive Docs                                                                      | `https://the-guild.dev/graphql/hive/docs`            |
| `NODE_ENV`                              | No                                         | The `NODE_ENV` value.                                                                         | `production`                                         |
| `GA_TRACKING_ID`                        | No                                         | The token for Google Analytics in order to track user actions.                                | `g6aff8102efda5e1d12e`                               |
| `GRAPHQL_PERSISTED_OPERATIONS`          | No                                         | Send persisted operation hashes instead of documents to the                                   |
| server.                                 | `1` (enabled) or `0` (disabled)            |

## Hive Hosted Configuration

This is only important if you are hosting Hive for getting 💰.

### Payments

| Name                | Required | Description            | Example Value          |
| ------------------- | -------- | ---------------------- | ---------------------- |
| `STRIPE_PUBLIC_KEY` | No       | The Stripe Public Key. | `g6aff8102efda5e1d12e` |

### Building the Docker Image

**Prerequisites:** Make sure you built the mono-repository using `pnpm build`.

```bash
docker build . --build-arg RELEASE=stable-main -t graphql-hive/app
```
