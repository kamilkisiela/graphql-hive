---
'@graphql-hive/core': patch
'@graphql-hive/apollo': patch
'@graphql-hive/envelop': patch
'@graphql-hive/yoga': patch
---

Report scalars returned by fields as used schema coordinates, including built-in scalars such as `String` and `ID`. Previously, a scalar was only reported when it was used as an input (argument, input object field or variable), so a scalar that was only returned by fields was considered unused.

**Every operation hash changes after upgrading.** The operation hash is computed from the reported schema coordinates, and every operation that selects a scalar field now reports additional coordinates. In Hive Console Insights, each operation appears as a new entry with a new hash once a client on this version starts reporting; the entries under the previous hash remain until their retention period expires. Links, saved filters and alerts that reference an operation by hash need to be updated.
