---
'hive': minor
---

Operations in Insights are now identified by their normalized body and operation name only. Reported schema coordinates no longer influence the hash, so an operation keeps one entry no matter which SDK version reports it or which variable values are provided when `processVariables` is enabled, and app deployment documents link to the right Insights operation regardless of when they were published.

**Every operation hash changes once when this version is deployed.** Entries under the previous hashes remain until their retention period expires. Links, saved filters and alerts that reference an operation by hash need to be updated.
