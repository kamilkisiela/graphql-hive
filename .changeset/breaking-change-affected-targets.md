---
'hive': minor
---

Record which targets a breaking change was used in. Schema checks and publishes with conditional breaking changes now store per-target request counts for each breaking change and for each of its top affected operations, exposed as `affectedTargets` on `SchemaChangeUsageStatistics` and `SchemaChangeUsageStatisticsAffectedOperation` in the public GraphQL API.
