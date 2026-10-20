# @graphql-hive/gateway-plugin-console-sdk

## 0.1.9

### Patch Changes

- Updated dependencies
  [[`e085b8e`](https://github.com/graphql-hive/console/commit/e085b8e1ef7a9197d285b2f3b4264fb47bf1a963)]:
  - @graphql-hive/core@0.23.2

## 0.1.8

### Patch Changes

- Updated dependencies
  [[`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)]:
  - @graphql-hive/core@0.23.1

## 0.1.7

### Patch Changes

- Updated dependencies
  [[`0961843`](https://github.com/graphql-hive/console/commit/0961843fdac3b2f9ae0e25d05bc48d25d2c63d4d),
  [`e30136b`](https://github.com/graphql-hive/console/commit/e30136baac429d2d77992e693b5a02eab5147977)]:
  - @graphql-hive/core@0.23.0

## 0.1.6

### Patch Changes

- [#8397](https://github.com/graphql-hive/console/pull/8397)
  [`cac2fc2`](https://github.com/graphql-hive/console/commit/cac2fc27162811ef0bc739f05793d273497d04ef)
  Thanks [@jdolle](https://github.com/jdolle)! - Deprecate run-time reporting schemas from `useHive`
  plugin.

  Use Hive CLI (`@graphql-hive/cli`) to publish the schema file instead. This aligns with best
  practices for schema management and prevents an issue where multiple service instances result in
  numerous publishes to Hive.

- Updated dependencies
  [[`cac2fc2`](https://github.com/graphql-hive/console/commit/cac2fc27162811ef0bc739f05793d273497d04ef)]:
  - @graphql-hive/core@0.22.5

## 0.1.5

### Patch Changes

- [#8379](https://github.com/graphql-hive/console/pull/8379)
  [`a6089c5`](https://github.com/graphql-hive/console/commit/a6089c5e869b1b83edda16d6452432428db3424d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Prevent validation failure by modifying selection
  set with hive specific typename aliases within `onExecute` plugin hook instead of `onParse` hook.

- [#8383](https://github.com/graphql-hive/console/pull/8383)
  [`85a3351`](https://github.com/graphql-hive/console/commit/85a33512ed9f03095d376fc586d737ac0183410d)
  Thanks [@jdolle](https://github.com/jdolle)! - Explicitly supports errors thrown in the gateway.
  I.e. authentication during execution.

  This adds a new field to the usage payload that specifically contains errors thrown within the
  gateway. This separates gateway errors from subgraph errors. All errors are currently ingested
  similarly into Clickhouse, but this change supports future improvements to show the source
  (subgraph name or gateway) of errors.

- Updated dependencies
  [[`85a3351`](https://github.com/graphql-hive/console/commit/85a33512ed9f03095d376fc586d737ac0183410d)]:
  - @graphql-hive/core@0.22.4

## 0.1.4

### Patch Changes

- [#8369](https://github.com/graphql-hive/console/pull/8369)
  [`dc32e0b`](https://github.com/graphql-hive/console/commit/dc32e0b43081f87cf6f41a820e5e6e76cd4aa687)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-yoga package to patch vulnerability

## 0.1.3

### Patch Changes

- [#8329](https://github.com/graphql-hive/console/pull/8329)
  [`33791da`](https://github.com/graphql-hive/console/commit/33791da958f6801d4a981c9147891724f39ef50c)
  Thanks [@jdolle](https://github.com/jdolle)! - Support Rust query planner execution by setting
  default operation root type name in collected payload's "paths" if not returned in subgraph call
  request info.
- Updated dependencies
  [[`33791da`](https://github.com/graphql-hive/console/commit/33791da958f6801d4a981c9147891724f39ef50c)]:
  - @graphql-hive/core@0.22.3

## 0.1.2

### Patch Changes

- Updated dependencies
  [[`658ff6a`](https://github.com/graphql-hive/console/commit/658ff6a644ef76787d1d283a34eab56c03f8ffa5)]:
  - @graphql-hive/core@0.22.2

## 0.1.1

### Patch Changes

- Updated dependencies
  [[`3dbda7d`](https://github.com/graphql-hive/console/commit/3dbda7dbe895173578cc4c452a85ef6c2ce07383)]:
  - @graphql-hive/core@0.22.1

## 0.1.0

### Minor Changes

- [#8062](https://github.com/graphql-hive/console/pull/8062)
  [`8270cac`](https://github.com/graphql-hive/console/commit/8270cac6516b20454914ee39d189e8c943487834)
  Thanks [@jdolle](https://github.com/jdolle)! - Initial plugin release.

  Hive Gateway offers addition subgraph call hooks that allow
  `@graphql-hive/gateway-plugin-console-sdk` to enhance usage data when enabling
  `fieldLevelMetricsEnabled`.

  The `fieldLevelMetricsEnabled` option enabled collecting:

  1. Error Codes: The error path and code (from `extensions.code`) are parsed from the graphql
     response errors.
  2. Resolution Counts: The number of times a schema coordinate is executed is extracted from
     graphql response data.

  And when this plugin is used, then these metrics can be collected directly from the subgraph
  calls. This further enhances the data to be closer to the underlying API (instead of error codes
  potentially being masked), and it allows collecting:

  3. Subgraph response times: How long a request takes to resolve is calculated for each subgraph
     call.
  4. Subgraph names: Attributes the resolution to the correct subgraph.

  These new datapoints allow Hive Console to enhance your usage insights to show accurate
  availability by coordinates, track error codes, and break down operations by subgraph so you get a
  more complete picture of your API.

### Patch Changes

- [#8291](https://github.com/graphql-hive/console/pull/8291)
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use npm trusted publishing.

- Updated dependencies
  [[`8270cac`](https://github.com/graphql-hive/console/commit/8270cac6516b20454914ee39d189e8c943487834),
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)]:
  - @graphql-hive/core@0.22.0
