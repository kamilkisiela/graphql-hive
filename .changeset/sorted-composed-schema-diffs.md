---
'hive': patch
---

Fix the schema check and history pages freezing on the Public Schema and Supergraph diffs of large schemas. Both schemas are now sorted before they are compared, so definitions that only moved (for example when types move between subgraphs) no longer show as changes, and a diff too large to compute shows a notice instead of locking the page. The unchanged Public Schema view of a check now shows the public schema instead of the service SDL.
