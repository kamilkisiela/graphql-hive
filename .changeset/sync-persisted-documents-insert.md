---
'hive': patch
---

Persisted documents are written to ClickHouse with a synchronous insert. A batch no longer joins the server-wide asynchronous insert queue, where it was coalesced with other uploads and waited behind other tables' flushes; its latency and memory are now those of its own rows.
