---
'hive': patch
---

Bound the ClickHouse insert of persisted documents by the upload's abort signal (55 s fallback) instead of a fixed 30 s request timeout, send a query id with it so server-side logs can be matched to traces, and stop re-sending a batch after a timeout: with asynchronous inserts the first copy is already buffered server-side, so a retry stored it twice. The `addPreprocessedDocumentsToAppDeployment` path now has the same 50 s budget as the worker path.
