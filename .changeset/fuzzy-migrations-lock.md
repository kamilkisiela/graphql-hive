---
'hive': major
---

**BREAKING CHANGE** Require the migration service to be configured with `REDIS_HOST`, `REDIS_PORT`, and
`REDIS_PASSWORD`. These variables must connect to the same Redis instance used by the API so database
migrations can acquire the schema registry lock before modifying registry state.
