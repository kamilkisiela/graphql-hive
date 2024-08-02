---
'@graphql-hive/apollo': patch
'@graphql-hive/core': patch
'@graphql-hive/yoga': patch
'@graphql-hive/cli': patch
---

Fixed a logging issue where both initiated requests and successful responses were being recorded. This was causing the logs to be filled with unnecessary information and affected `hive artifact:fetch --artifact` command.
