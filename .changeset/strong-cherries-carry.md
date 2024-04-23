---
"@graphql-hive/yoga": minor
---

🚨 BREAKING CHANGE 🚨 `useYogaHive`, `createYogaHive` is now `useHive` and `createHive`

```diff
- import { useYogaHive, createYogaHive } from '@graphql-hive/client';
+ import { useHive, createHive } from '@graphql-hive/yoga';
```
