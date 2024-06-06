---
'@graphql-hive/core': patch
'@graphql-hive/envelop': patch
'@graphql-hive/yoga': patch
'@graphql-hive/apollo': patch
---

Prevent failing usage reporting when returning an object with additional properties aside from
`name` and `version` from the client info object/factory function.
