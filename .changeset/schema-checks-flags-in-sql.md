---
'hive': patch
---

Listing `Target.schemaChecks` with only `hasSchemaChanges` or `hasUnapprovedBreakingChanges` selected no longer loads each check's change lists; both flags are computed in the database.
