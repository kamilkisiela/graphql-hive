---
'hive': patch
---

Paged `SchemaChangeConnection` results (a schema check's `breakingSchemaChanges`, `safeSchemaChanges`, `schemaChanges` and the `changes` of a safe-change group, on the check and on its contract checks) now report their position: `edges.cursor` encodes the change's offset, `hasNextPage` and `hasPreviousPage` say whether more follow or precede the page, `startCursor` is empty on the first page and `endCursor` empty on the last, and `total` and `totalCount` count the whole list rather than the page.
