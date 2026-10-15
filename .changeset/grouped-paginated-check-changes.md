---
'hive': patch
---

Fix the schema check page freezing on checks with thousands of schema changes. Safe changes are now grouped by kind, and breaking changes and each group are paginated 50 at a time, so the 5 types a check added are no longer buried among thousands of description edits. A check's schemas are only loaded when a schema tab is opened, so the check itself loads without them.
