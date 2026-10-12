---
'hive': major
---

**BREAKING CHANGE**: Before upgrading to this
version, you must first upgrade to `hive@13.1.0`. Do not upgrade directly from an earlier version
while the system is serving traffic.

To perform a rolling upgrade:

1. Upgrade all running services to `hive@13.1.0`.
2. Wait until all database migrations for `hive@13.1.0` have completed successfully and that version is serving traffic.
3. Upgrade all services to this major version and wait for the database migration to complete.

If downtime is acceptable, you can instead stop all traffic and running services, then upgrade
directly to this version and run the migrations before bringing the system back online.

____

Backfill latest contract versions from `contract_versions` to `schema_versions`.
