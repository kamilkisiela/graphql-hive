---
"@graphql-hive/yoga": minor
---

🚨 BREAKING CHANGE 🚨 `useYogaHive`, `createYogaHive` is now `useHive` and `createHive`

**Migration**

Migration steps are available in the README.

```diff
- import { useYogaHive, createYogaHive } from '@graphql-hive/client';
+ import { useHive, createHive } from '@graphql-hive/yoga';
```
