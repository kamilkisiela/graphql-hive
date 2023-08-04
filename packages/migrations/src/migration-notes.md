# Migration

Both `operation_collection` and `operations` requires a complete reinsert of rows.

New tables have a TTL of 1 day. We need to remove TTL until we migrate the data, because re-inserted
rows will be dropped (TTL). The TTL should be applied after the migration is completed.

**Steps**

1. Create new tables and views with `_temp` suffix.

   STATE: `operations` and `operations_temp`.

1. Start writing to new tables.

   STATE: `operations` and `operations_temp` in `usage-ingestor` service

1. Wait a day.

1. Delete rows from the previous day

   STATE: `operations` and `operations_temp`

   PROBLEM: it won't work for materialized views as we can't delete rows from it...

   TASK: check if we can delete from internal table.

1. Insert data from previous days into new tables.

   STATE: `operations` and `operations_temp`

1. Rename old tables and views to add `_old` suffix and new tables and views to remove `_temp`
   suffix.

   STATE: `operations` and `operations_old`

   PROBLEM: `usage-ingestor` writes to `operations_temp` and `operations` and `_temp` will no longer
   be there

1. Deploy code to use new tables (`operation_collection_body`, `operation_collection_details` and
   `operations_minutely`).

   REQUIRES: full data migration

1. Apply original TTL on `operations_temp` and `operation_collection_temp`.

   REQUIRES: full data migration

1. Stop writing to old tables. (`usage-ingestor` service)

   PROBLEM: we can't stop writing to tables with `_temp` suffix.

1. Delete old tables and views.

   STATE: `operations` and `operations_old`
