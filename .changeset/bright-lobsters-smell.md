---
'@graphql-hive/cli': minor
---

Changes the default behavior of `hive dev` command. Now schema composition is done locally, without substituting subgraphs available in the registry.

We added `--remote` flag to the `hive dev` command to mimic the previous behavior.

**Breaking Change**
The `$ hive dev` command is still a work in progress (as stated in the command description).
That's why we are not considering this a breaking change, but a minor change.

**_Before:_**

The `hive dev` command would substitute subgraphs available in the registry with their local counterparts, performing schema composition over the network according to your project's configuration.

**_After:_**

The `hive dev` command will now perform schema composition locally, without substituting subgraphs available in the registry. This is the default behavior.

To mimic the previous behavior, you can apply the `--remote` flag and continue using the command as before.


