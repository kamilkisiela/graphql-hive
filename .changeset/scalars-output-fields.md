---
'@graphql-hive/core': patch
'@graphql-hive/apollo': patch
'@graphql-hive/envelop': patch
'@graphql-hive/yoga': patch
'@graphql-hive/gateway-plugin-console-sdk': patch
---

Report the type returned by every field and the type condition of every fragment as used schema coordinates: scalars (including built-ins such as `String` and `ID`), enums, objects, interfaces and unions. Previously, a type was only reported when it was used as an input or when one of its own fields was selected, so a scalar that was only returned by fields or a union was considered unused, and removing it passed schema checks as safe based on usage.
