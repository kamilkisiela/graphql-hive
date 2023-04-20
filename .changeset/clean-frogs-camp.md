---
'@graphql-hive/cli': minor
---

Introduce new config file format. Please move the `accessToken` property to a `registry` object.

The old top-level property approach is now considered deprecated and will no longer be supported in the next major version of the CLI.

```diff
 {
-  "accessToken": "xxxxxd4cxxx980xxxxf3099efxxxxx"
+  "registry": {
+      "accessToken": "xxxxxd4cxxx980xxxxf3099efxxxxx"
+  }
 }
```
