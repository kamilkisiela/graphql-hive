---
'@graphql-hive/cli': minor
---

Fetch a specific schema sdl or supergraph from the API using the action id (commit sha) with the `hive schema:fetch` command.

Example:

```bash
hive schema:fetch 99dad865e1d710b359049f52be0b018 -T supergraph -W supergraph.graphql
```
