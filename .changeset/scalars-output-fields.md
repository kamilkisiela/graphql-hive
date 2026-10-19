---
'@graphql-hive/core': patch
'@graphql-hive/apollo': patch
'@graphql-hive/envelop': patch
'@graphql-hive/yoga': patch
---

Report scalars returned by fields as used schema coordinates, including built-in scalars such as `String` and `ID`. Previously, a scalar was only reported when it was used as an input (argument, input object field or variable), so a scalar that was only returned by fields was considered unused.
