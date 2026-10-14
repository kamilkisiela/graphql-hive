---
'@graphql-hive/cli': patch
---

`hive app:create` now waits up to 55 seconds for each document upload request (previously 20 seconds), the same as the schema commands. Slow uploads completed on the server but the CLI gave up, retried the whole batch, and finally failed with a network error.
