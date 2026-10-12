---
'@graphql-hive/cli': minor
---

`hive schema:publish --github` now exits with code 1 (error `[300]`) when the publish is rejected,
for example by breaking changes or `--fail-on-composition-error`. Previously it exited with 0
whenever the GitHub check-run was updated. `--force` still reports a forced success, as without
`--github`.

**Note for self-hosted Hive:** `hive schema:publish --github` relies on a new field added to the Hive
GraphQL API (`GitHubSchemaPublishSuccess`). If you self-host Hive and the CLI reports error `[125]`
(unsupported Hive server version), deploy the latest Hive backend before upgrading the CLI.
