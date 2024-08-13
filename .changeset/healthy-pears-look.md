---
'@graphql-hive/apollo': patch
'@graphql-hive/core': patch
'@graphql-hive/yoga': patch
'@graphql-hive/envelop': patch
---

Fixed issue where usage reports were sent only on app disposal or max batch size, now also sent at
set intervals.
