---
'hive': patch
---

Give the persisted-document worker 50 seconds instead of 20 to finish an `addDocumentsToAppDeployment` batch, so the server answers before the CLI's 55 second upload timeout instead of the CLI aborting a batch the server is still processing.
