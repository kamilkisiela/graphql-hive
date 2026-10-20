---
'hive': patch
---

Trace persisted document ingestion inside the GraphQL API's worker threads. The worker's spans (schema build, document validation, the ClickHouse insert, every S3 object write with its status and retry count, and how long a batch waited for a worker) now join the request's trace, every log line a batch produces in the worker carries the request id, and spans still buffered when a worker exits or the API shuts down are flushed first.
