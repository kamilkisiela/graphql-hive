---
'hive': minor
---

Introduce temporary dual writes of contract versions to both the `contract_versions` and
`schema_versions` table. This release is an intermediate rollout step required to bring the database
and application into a consistent state before subsequent graph-related changes are deployed.
