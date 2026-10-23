---
'hive': major
---

**BREAKING CHANGE**: Move GitHub and Slack integration callbacks from the web app service to the server service and
reject invalid organization identifiers.

Self-hosted deployments must move `INTEGRATION_GITHUB_APP_NAME`, `INTEGRATION_SLACK`,
`INTEGRATION_SLACK_CLIENT_ID`, and `INTEGRATION_SLACK_CLIENT_SECRET` from the web app container to
the server container. Requests to `/api/github/*` and `/api/slack/*` must now be routed to the server
service.

The `Mutation.addSlackIntegration` and `Mutation.addGitHubIntegration` and `Query.organizationByGitHubInstallationId` fields  have been removed from the GraphQL schema as they are no longer needed for the process of adding either a Slack or GitHub integration.
