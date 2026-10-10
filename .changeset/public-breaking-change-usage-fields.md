---
'hive': minor
---

Expose `SchemaChange.path` and `SchemaCheckConditionalBreakingChangeMetadata.settings` on the public GraphQL API, so the targets and schema coordinate behind a breaking change's usage can be read without parsing the change message.
