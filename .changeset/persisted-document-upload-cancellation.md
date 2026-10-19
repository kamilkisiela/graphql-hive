---
'hive': patch
---

When a persisted-document upload of an app deployment is aborted by the client, times out on the server, or one of its storage writes fails, every remaining object storage and ClickHouse request of that batch is cancelled, including pending retries. Previously the worker kept uploading the whole batch after the request was already over.
