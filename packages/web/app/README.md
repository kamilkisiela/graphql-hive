# `@hive/app`

The Hive application as seen on https://app.graphql-hive.com/.

## Configuration

The following environment variables configure the application.

| Name                                    | Required                                   | Description                                                                                   | Example Value                                        |
| --------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `APP_BASE_URL`                          | **Yes**                                    | The base url of the app,                                                                      | `https://app.graphql-hive.com`                       |
| `SERVER_ENDPOINT`                       | **Yes**                                    | The endpoint of the Hive server.                                                              | `http://127.0.0.1:4000`                              |
| `GRAPHQL_ENDPOINT`                      | **Yes**                                    | The endpoint of the Hive GraphQL API.                                                         | `http://127.0.0.1:4000/graphql`                      |
| `EMAILS_ENDPOINT`                       | **Yes**                                    | The endpoint of the GraphQL Hive Email service.                                               | `http://127.0.0.1:6260`                              |
| `SUPERTOKENS_CONNECTION_URI`            | **Yes**                                    | The URI of the SuperTokens instance.                                                          | `http://127.0.0.1:3567`                              |
| `SUPERTOKENS_API_KEY`                   | **Yes**                                    | The API KEY of the SuperTokens instance.                                                      | `iliketurtlesandicannotlie`                          |
| `INTEGRATION_SLACK`                     | No                                         | Whether the Slack integration is enabled or disabled.                                         | `1` (enabled) or `0` (disabled)                      |
| `INTEGRATION_SLACK_SLACK_CLIENT_ID`     | No (**Yes** if `INTEGRATION_SLACK` is set) | The Slack client ID.                                                                          | `g6aff8102efda5e1d12e`                               |
| `INTEGRATION_SLACK_SLACK_CLIENT_SECRET` | No (**Yes** if `INTEGRATION_SLACK` is set) | The Slack client secret.                                                                      | `g12e552xx54xx2b127821dc4abc4491dxxxa6b187`          |
| `INTEGRATION_GITHUB_APP_NAME`           | No                                         | The GitHub application name.                                                                  | `graphql-hive-self-hosted`                           |
| `AUTH_GITHUB`                           | No                                         | Whether login via GitHub should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_GITHUB_CLIENT_ID`                 | No (**Yes** if `AUTH_GITHUB` is set)       | The GitHub client ID.                                                                         | `g6aff8102efda5e1d12e`                               |
| `AUTH_GITHUB_CLIENT_SECRET`             | No (**Yes** if `AUTH_GITHUB` is set)       | The GitHub client secret.                                                                     | `g12e552xx54xx2b127821dc4abc4491dxxxa6b187`          |
| `AUTH_GOOGLE`                           | No                                         | Whether login via Google should be allowed                                                    | `1` (enabled) or `0` (disabled)                      |
| `AUTH_GOOGLE_CLIENT_ID`                 | No (**Yes** if `AUTH_GOOGLE` is set)       | The Google client ID.                                                                         | `g6aff8102efda5e1d12e`                               |
| `AUTH_GOOGLE_CLIENT_SECRET`             | No (**Yes** if `AUTH_GOOGLE` is set)       | The Google client secret.                                                                     | `g12e552xx54xx2b127821dc4abc4491dxxxa6b187`          |
| `AUTH_ORGANIZATION_OIDC`                | No                                         | Whether linking a Hive organization to an Open ID Connect provider is allowed. (Default: `0`) | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA`                             | No                                         | Whether login via Okta should be allowed                                                      | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA_CLIENT_ENDPOINT`             | No (**Yes** if `AUTH_OKTA` is set)         | The Okta endpoint.                                                                            | `https://dev-1234567.okta.com`                       |
| `AUTH_OKTA_HIDDEN`                      | No                                         | Whether the Okta login button should be hidden. (Default: `0`)                                | `1` (enabled) or `0` (disabled)                      |
| `AUTH_OKTA_CLIENT_ID`                   | No (**Yes** if `AUTH_OKTA` is set)         | The Okta client ID.                                                                           | `g6aff8102efda5e1d12e`                               |
| `AUTH_OKTA_CLIENT_SECRET`               | No (**Yes** if `AUTH_OKTA` is set)         | The Okta client secret.                                                                       | `g12e552xx54xx2b127821dc4abc4491dxxxa6b187`          |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`       | No                                         | Whether verifying the email address is mandatory.                                             | `1` (enabled) or `0` (disabled)                      |
| `ENVIRONMENT`                           | No                                         | The environment of your Hive app. (**Note:** This will be used for Sentry reporting.)         | `staging`                                            |
| `SENTRY_DSN`                            | No                                         | The DSN for reporting errors to Sentry.                                                       | `https://dooobars@o557896.ingest.sentry.io/12121212` |
| `SENTRY_ENABLED`                        | No                                         | Whether Sentry error reporting should be enabled.                                             | `1` (enabled) or `0` (disabled)                      |
| `DOCS_URL`                              | No                                         | The URL of the Hive Docs                                                                      | `https://the-guild.dev/graphql/hive/docs`            |
| `NODE_ENV`                              | No                                         | The `NODE_ENV` value.                                                                         | `production`                                         |
| `GA_TRACKING_ID`                        | No                                         | The token for Google Analytics in order to track user actions.                                | `g6aff8102efda5e1d12e`                               |
| `CRISP_WEBSITE_ID`                      | No                                         | The Crisp Website ID                                                                          | `g6aff8102efda5e1d12e`                               |
| `GRAPHQL_PERSISTED_OPERATIONS`          | No                                         | Send persisted oepration hashes instead of documents to the server.                           | `1` (enabled) or `0` (disabled)                      |

## Hive Hosted Configuration

This is only important if you are hosting Hive for getting 💰.

### Payments

| Name                | Required | Description            | Example Value          |
| ------------------- | -------- | ---------------------- | ---------------------- |
| `STRIPE_PUBLIC_KEY` | No       | The Stripe Public Key. | `g6aff8102efda5e1d12e` |

### Legacy Auth0 Configuration

If you are not self-hosting GraphQL Hive, you can ignore this section. It is only required for the
legacy Auth0 compatibility layer.

| Name                                      | Required                                   | Description                                                                                               | Example Value                               |
| ----------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `AUTH_LEGACY_AUTH0`                       | No                                         | Whether the legacy Auth0 import is enabled.                                                               | `1` (enabled) or `0` (disabled)             |
| `AUTH_LEGACY_AUTH0_CLIENT_ID`             | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The Auth0 client ID.                                                                                      | `rDSpExxD8sfqlpF1kbxxLkMNYI2Sxxx`           |
| `AUTH_LEGACY_AUTH0_CLIENT_SECRET`         | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The Auth0 client secret.                                                                                  | `e43f156xx54en2b56117dc4abc4491dxxbb6b187`  |
| `AUTH_LEGACY_AUTH0_ISSUER_BASE_URL`       | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The Auth0 issuer base url.                                                                                | `https://your-project.us.auth0.com`         |
| `AUTH_LEGACY_AUTH0_AUDIENCE`              | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The Auth0 audience                                                                                        | `https://your-project.us.auth0.com/api/v2/` |
| `AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT` | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The internal endpoint for importing Auth0 accounts. (**Note:** This route is within the GraphQL service.) | `http://127.0.0.1:4000/__legacy`            |
| `AUTH_LEGACY_AUTH0_INTERNAL_API_KEY`      | No (**Yes** if `AUTH_LEGACY_AUTH0` is set) | The internal endpoint key.                                                                                | `iliketurtles`                              |

### Building the Docker Image

**Prerequisites:** Make sure you built the mono-repository using `pnpm build`.

```bash
docker build . --build-arg RELEASE=stable-main -t graphql-hive/app
```
