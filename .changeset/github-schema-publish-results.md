---
'hive': minor
---

Report schema publish results to the Hive CLI when the GitHub integration is used.

`GitHubSchemaPublishSuccess` now has an `isValid` field, so the CLI can fail a CI job when a
`--github` publish is rejected.
