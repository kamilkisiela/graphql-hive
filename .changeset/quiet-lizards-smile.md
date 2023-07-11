---
'@graphql-hive/cli': patch
---

Close event on a socket will only be set once, if the abortController doesn't exist yet.
