---
'@graphql-hive/core': minor
---

`hashOperation` and `preprocessOperation` now derive an operation's hash from its normalized body and operation name only. Reported schema coordinates no longer take part, so the same operation keeps one hash regardless of which coordinates a client reports or which variable values were provided.
