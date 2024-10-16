# @graphql-hive/core

## 0.8.1

### Patch Changes

- [#5667](https://github.com/kamilkisiela/graphql-hive/pull/5667)
  [`be5d39c`](https://github.com/kamilkisiela/graphql-hive/commit/be5d39cbf08d0681d142e83a708d300abc504c44)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Report enum values when an enum is used
  as an output type

## 0.8.0

### Minor Changes

- [#5401](https://github.com/kamilkisiela/graphql-hive/pull/5401)
  [`3ffdb6e`](https://github.com/kamilkisiela/graphql-hive/commit/3ffdb6e9466deb3c3aa09eea1445fc4caf698fd5)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Deduplicate persisted document lookups from the
  registry for reducing the amount of concurrent HTTP requests.

## 0.7.1

### Patch Changes

- [#5367](https://github.com/kamilkisiela/graphql-hive/pull/5367)
  [`a896642`](https://github.com/kamilkisiela/graphql-hive/commit/a896642197e6d7779ba7ed71f365dfbd80532282)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Move createSupergraphSDLFetcher to
  @graphql-hive/core package

## 0.7.0

### Minor Changes

- [#5307](https://github.com/kamilkisiela/graphql-hive/pull/5307)
  [`0a3b24d`](https://github.com/kamilkisiela/graphql-hive/commit/0a3b24d400770c2cc84642959febb9288ad1c1b7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Re-introduce retry logging removed in previous
  release.

### Patch Changes

- [#5361](https://github.com/kamilkisiela/graphql-hive/pull/5361)
  [`3f03e7b`](https://github.com/kamilkisiela/graphql-hive/commit/3f03e7b3a65707ba8aa04335684f0aa8d261868f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fixed issue where usage reports were
  sent only on app disposal or max batch size, now also sent at set intervals.

## 0.6.1

### Patch Changes

- [#5304](https://github.com/kamilkisiela/graphql-hive/pull/5304)
  [`f2fef08`](https://github.com/kamilkisiela/graphql-hive/commit/f2fef08e9d1e13cb4a89d3882922db6dc822542e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fixed a logging issue where both
  initiated requests and successful responses were being recorded. This was causing the logs to be
  filled with unnecessary information and affected `hive artifact:fetch --artifact` command.

## 0.6.0

### Minor Changes

- [#5234](https://github.com/kamilkisiela/graphql-hive/pull/5234)
  [`e6dc5c9`](https://github.com/kamilkisiela/graphql-hive/commit/e6dc5c9df34c30c52555b27b0bca50e0be75480b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improved logging output of HTTP requests and
  retires.

## 0.5.0

### Minor Changes

- [#5116](https://github.com/kamilkisiela/graphql-hive/pull/5116)
  [`f1e43c6`](https://github.com/kamilkisiela/graphql-hive/commit/f1e43c641f3ebac931839c7dfbdcb3a885167562)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Added `collectRawUsage` to Hive Client core
  package

## 0.4.0

### Minor Changes

- [#5097](https://github.com/kamilkisiela/graphql-hive/pull/5097)
  [`b8998e7`](https://github.com/kamilkisiela/graphql-hive/commit/b8998e7ead84a2714d13678aaf1e349e648eb90a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add retry mechanism to the http client

## 0.3.1

### Patch Changes

- [#4932](https://github.com/kamilkisiela/graphql-hive/pull/4932)
  [`cbc8364`](https://github.com/kamilkisiela/graphql-hive/commit/cbc836488b4acfb618fd877005ecf0126f1706b6)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Prevent failing usage reporting when returning an
  object with additional properties aside from `name` and `version` from the client info
  object/factory function.

## 0.3.0

### Minor Changes

- [#4573](https://github.com/kamilkisiela/graphql-hive/pull/4573)
  [`06d465e`](https://github.com/kamilkisiela/graphql-hive/commit/06d465e882b569b6d0dbd5b271d2d98aafaec0b1)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Moved most of @graphql-hive/client code
  here

- [#4494](https://github.com/kamilkisiela/graphql-hive/pull/4494)
  [`c5eeac5`](https://github.com/kamilkisiela/graphql-hive/commit/c5eeac5ccef9e2dcc3c8bb33deec0fb95af9552e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - 🚨 BREAKING CHANGE 🚨 Requires now Node
  v16+

## 0.2.4

### Patch Changes

- [#4328](https://github.com/kamilkisiela/graphql-hive/pull/4328)
  [`bb0ff23`](https://github.com/kamilkisiela/graphql-hive/commit/bb0ff238ee7a413aca618b05cdf2187e6b886188)
  Thanks [@Hebilicious](https://github.com/Hebilicious)! - Use node specifier for crypto import

## 0.2.3

### Patch Changes

- [#668](https://github.com/kamilkisiela/graphql-hive/pull/668)
  [`e116841`](https://github.com/kamilkisiela/graphql-hive/commit/e116841a739bfd7f37c4a826544301cf23d61637)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix ESM/CJS issue

## 0.2.2

### Patch Changes

- ad66973: Bump

## 0.2.1

### Patch Changes

- 0a5dbeb: Point to graphql-hive.com

## 0.2.0

### Minor Changes

- ac9b868c: Support GraphQL v16

## 0.1.0

### Minor Changes

- d7348a3: Hide literals and remove aliases

### Patch Changes

- d7348a3: Pick operation name from DocumentNode

## 0.0.5

### Patch Changes

- c6ef3d2: Bob update

## 0.0.4

### Patch Changes

- 4a7c569: Share operation hashing

## 0.0.3

### Patch Changes

- 6b74355: Fix sorting

## 0.0.2

### Patch Changes

- 094c861: Normalization of operations
