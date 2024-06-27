# @graphql-hive/yoga

## 0.33.2

### Patch Changes

- [#5097](https://github.com/kamilkisiela/graphql-hive/pull/5097)
  [`b8998e7`](https://github.com/kamilkisiela/graphql-hive/commit/b8998e7ead84a2714d13678aaf1e349e648eb90a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Use built-in retry of http client of
  the core package

- Updated dependencies
  [[`b8998e7`](https://github.com/kamilkisiela/graphql-hive/commit/b8998e7ead84a2714d13678aaf1e349e648eb90a)]:
  - @graphql-hive/core@0.4.0

## 0.33.1

### Patch Changes

- [#4932](https://github.com/kamilkisiela/graphql-hive/pull/4932)
  [`cbc8364`](https://github.com/kamilkisiela/graphql-hive/commit/cbc836488b4acfb618fd877005ecf0126f1706b6)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Prevent failing usage reporting when returning an
  object with additional properties aside from `name` and `version` from the client info
  object/factory function.
- Updated dependencies
  [[`cbc8364`](https://github.com/kamilkisiela/graphql-hive/commit/cbc836488b4acfb618fd877005ecf0126f1706b6)]:
  - @graphql-hive/core@0.3.1

## 0.33.0

### Minor Changes

- [#4573](https://github.com/kamilkisiela/graphql-hive/pull/4573)
  [`06d465e`](https://github.com/kamilkisiela/graphql-hive/commit/06d465e882b569b6d0dbd5b271d2d98aafaec0b1)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Break `@graphql-hive/client` into
  library-specific packages:

  - `@graphql-hive/core` - Core functionality
  - `@graphql-hive/apollo` - Apollo Client integration
  - `@graphql-hive/yoga` - Yoga Server integration
  - `@graphql-hive/envelop` - Envelop integration

  Migration steps are available in the README of each package.

- [#4494](https://github.com/kamilkisiela/graphql-hive/pull/4494)
  [`c5eeac5`](https://github.com/kamilkisiela/graphql-hive/commit/c5eeac5ccef9e2dcc3c8bb33deec0fb95af9552e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - 🚨 BREAKING CHANGE 🚨 Requires now Node
  v16+

- [#4573](https://github.com/kamilkisiela/graphql-hive/pull/4573)
  [`06d465e`](https://github.com/kamilkisiela/graphql-hive/commit/06d465e882b569b6d0dbd5b271d2d98aafaec0b1)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - 🚨 BREAKING CHANGE 🚨 `useYogaHive`,
  `createYogaHive` is now `useHive` and `createHive`

  **Migration**

  Migration steps are available in the README.

  ```diff
  - import { useYogaHive, createYogaHive } from '@graphql-hive/client';
  + import { useHive, createHive } from '@graphql-hive/yoga';
  ```

### Patch Changes

- Updated dependencies
  [[`06d465e`](https://github.com/kamilkisiela/graphql-hive/commit/06d465e882b569b6d0dbd5b271d2d98aafaec0b1),
  [`c5eeac5`](https://github.com/kamilkisiela/graphql-hive/commit/c5eeac5ccef9e2dcc3c8bb33deec0fb95af9552e)]:
  - @graphql-hive/core@0.3.0
