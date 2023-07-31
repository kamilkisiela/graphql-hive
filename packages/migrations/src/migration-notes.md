Both `operation_collection` and `operations` requires a complete reinsert of rows. They have a TTL
of 1 day, but we need to remove TTL until we migrate the data. The TTL should be applied some time
after the migration is complete.

## Migration

1. Create new tables and views with `_temp` suffix.
1. Start writing to new tables.
1. After a day, delete rows from the previous day.
1. Stop writing to old tables.
1. Insert data from previous days into new tables.
1. Apply original TTL on `operations_temp` and `operation_collection_temp`.
1. Rename old tables and views to add `_old` suffix.
1. Rename tables and views to remove `_temp` suffix.
1. Deploy code to use new tables.
1. Delete old tables and views.
