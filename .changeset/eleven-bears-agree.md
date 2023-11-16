---
'@graphql-hive/cli': minor
---

Associate schema checks with context ID for remembering approved breaking schema changes for subsequent schema checks when running the `schema:check` command.

If you are using the `--github` flag, all you need to do is to upgrade to this version. The `context` will be automatically be the pull request scope.

On pull request branch GitHub Action:

```bash
hive schema:check --github ./my-schema.graphql
```

If you are not using GitHub Repositories and Actions, you can manually provide a context ID with the `--contextId` flag.

```bash
hive schema:check --contextId "pull-request-69" ./my-schema.graphql
```

[Learn more in the product update.](https://the-guild.dev/graphql/hive/product-updates/2023-11-16-schema-check-breaking-change-approval-context)
