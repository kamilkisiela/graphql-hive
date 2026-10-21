---
'@graphql-hive/cli': patch
---

`app:create` retries a failed document upload batch at most twice (three attempts in total) instead of five times.
