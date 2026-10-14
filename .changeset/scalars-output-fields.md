---
'@graphql-hive/core': patch
'@graphql-hive/apollo': patch
'@graphql-hive/envelop': patch
'@graphql-hive/yoga': patch
---

Report scalars returned by fields as used schema coordinates, including built-in scalars such as `String` and `ID`. Previously, a scalar was only reported when it was used as an input (argument, input object field or variable), so a scalar that is only returned by fields was considered unused.

Operations that select a field returning a scalar are reported with additional schema coordinates, so most operations are listed under a new operation hash in Insights after upgrading.
