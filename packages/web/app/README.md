# `@hive/app`

The Hive application as seen on https://app.graphql-hive.com/.

## Docs

- [Routing](./docs/ROUTER.md): layouts, navigation, redirects and how to add a page.
- [Data loading](./docs/DATA.md): route loaders, request policies, pagination, preloading and
  loading states.

## Configuration

The following environment variables configure the application.

| Name                              | Required | Description                                                                                   | Example Value                                        |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `APP_BASE_URL`                    | **Yes**  | The base url of the app,                                                                      | `https://app.graphql-hive.com`                       |
| `GRAPHQL_PUBLIC_ENDPOINT`         | **Yes**  | The public endpoint of the Hive GraphQL API.                                                  | `http://127.0.0.1:4000/graphql`                      |
| `GRAPHQL_PUBLIC_ORIGIN`           | **Yes**  | The http address origin of the Hive GraphQL server.                                           | `http://127.0.0.1:4000/`                             |
| `AUTH_GITHUB`                     | No       | Whether login via GitHub should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_GOOGLE`                     | No       | Whether login via Google should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_ORGANIZATION_OIDC`          | No       | Whether linking a Hive organization to an Open ID Connect provider is allowed. (Default: `0`) | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA`                       | No       | Whether login via Okta should be allowed                                                      | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA_HIDDEN`                | No       | Whether the Okta login button should be hidden. (Default: `0`)                                | `1` (enabled) or `0` (disabled)                      |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | No       | Whether verifying the email address is mandatory.                                             | `1` (enabled) or `0` (disabled)                      |
| `ENVIRONMENT`                     | No       | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)         | `staging`                                            |
| `SENTRY_DSN`                      | No       | The DSN for reporting errors to Sentry.                                                       | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`                  | No       | Whether Sentry error reporting should be enabled.                                             | `1` (enabled) or `0` (disabled)                      |
| `DOCS_URL`                        | No       | The URL of the Hive Docs                                                                      | `https://the-guild.dev/graphql/hive/docs`            |
| `NODE_ENV`                        | No       | The `NODE_ENV` value.                                                                         | `production`                                         |
| `GRAPHQL_PERSISTED_OPERATIONS`    | No       | Send persisted operation hashes instead of documents to the server.                           | `1` (enabled) or `0` (disabled)                      |

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
