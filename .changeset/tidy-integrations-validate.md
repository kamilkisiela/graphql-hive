---
'hive': major
---

**BREAKING CHANGE**: Move GitHub and Slack integration callbacks from the web app service to the server service and
reject invalid organization identifiers.

Self-hosted deployments must move `INTEGRATION_GITHUB_APP_NAME`, `INTEGRATION_SLACK`,
`INTEGRATION_SLACK_CLIENT_ID`, and `INTEGRATION_SLACK_CLIENT_SECRET` from the web app container to
the server container. The integration routes (`/api/github/*` and `/api/slack/*`) are now served by
the server service (`GRAPHQL_PUBLIC_ORIGIN`).

The GitHub integration now verifies that the user installing the GitHub App has access to the
installation. Self-hosted deployments using the GitHub integration must:

- enable **"Request user authorization (OAuth) during installation"** in the GitHub App settings
- set the GitHub App **Callback URL** to `<GRAPHQL_PUBLIC_ORIGIN>/api/github/callback`
- set `INTEGRATION_GITHUB_APP_CLIENT_ID` and `INTEGRATION_GITHUB_APP_CLIENT_SECRET` (from the GitHub
  App settings) on the server container

The `/api/github/setup-callback` route has been removed, as GitHub no longer uses the Setup URL
once user authorization during installation is enabled. The Slack app redirect URL must be set to
`<GRAPHQL_PUBLIC_ORIGIN>/api/slack/callback`.

The `Mutation.addSlackIntegration` and `Mutation.addGitHubIntegration` and `Query.organizationByGitHubInstallationId` fields  have been removed from the GraphQL schema as they are no longer needed for the process of adding either a Slack or GitHub integration.
