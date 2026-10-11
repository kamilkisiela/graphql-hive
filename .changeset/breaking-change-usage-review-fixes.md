---
'hive': patch
---

Check access before resolving `BreakingChangeMetadataTarget.target`; load a schema check's changes in `Target.schemaChecks` when only `hasSchemaChanges` or `hasUnapprovedBreakingChanges` is selected; expose `breakingChangeFormula`, `requestCount` and the excluded app deployments on a check's conditional breaking change settings; and stop storing usage statistics for changes found safe by the nullability check.
