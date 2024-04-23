---
"@graphql-hive/apollo": minor
---

🚨 BREAKING CHANGE 🚨 `hiveApollo` is now `useHive`

**Migration**

Migration steps are available in the README.

```diff
- import { hiveApollo } from '@graphql-hive/client';
+ import { useHive } from '@graphql-hive/apollo';
```
