---
'@graphql-hive/cli': patch
---

Fix empty error list when running operations:check command (cause of the issue: GraphQL Inspector
returns both errors and deprecation warnings)
