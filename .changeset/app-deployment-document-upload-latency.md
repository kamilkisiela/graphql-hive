---
'hive': patch
---

Upload persisted documents of an app deployment to the primary and mirror object storage concurrently instead of one after the other, and give the persisted-document worker 50 seconds instead of 20 to finish an `addDocumentsToAppDeployment` batch. Slow object storage writes made `hive app:create` uploads fail with `Unexpected error.` or time out in the CLI.
