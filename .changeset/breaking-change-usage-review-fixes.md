---
'hive': patch
---

Count the top affected operations and clients of an argument made required on its field, matching how the change is judged breaking; check access before resolving `BreakingChangeMetadataTarget.target`; and load a schema check's changes in `Target.schemaChecks` when only `hasSchemaChanges` or `hasUnapprovedBreakingChanges` is selected.
