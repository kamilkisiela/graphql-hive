---
'hive': patch
---

Stop calling breaking changes "safe based on usage data" when Hive doesn't record usage for what they change, such as a removed type, a removed union member or a new required argument. They now say that usage isn't tracked for them, and the version history summary counts them as not checked against usage instead of safe. Changes with nothing more to show no longer open to "No details available".
