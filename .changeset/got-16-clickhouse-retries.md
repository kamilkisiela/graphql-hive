---
'hive': patch
---

Upgrade `got` to v16 to fix ClickHouse requests failing with `write ECANCELED` (`Canceled because of SSL destruction`) instead of being retried.

Since Node.js v24.20.0, a connection that closes while a request body is still being sent reports the error to `got` in a way that `got` v14 turned into an immediate failure, skipping the retry logic of the ClickHouse clients.
