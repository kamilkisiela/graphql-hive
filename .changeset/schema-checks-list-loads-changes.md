---
'hive': patch
---

Fix `Target.schemaChecks` returning no changes when they are selected through the `SchemaCheck` interface or through `schemaChanges`, which made the public API list every check without its changes.
