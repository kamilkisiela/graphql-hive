# @hive/server

## 0.27.8

### Patch Changes

- Updated dependencies [a33cdcef]
  - @graphql-hive/client@0.15.2

## 0.27.7

### Patch Changes

- Updated dependencies [cd998fab]
  - @graphql-hive/client@0.15.1

## 0.27.6

### Patch Changes

- Updated dependencies [ac9b868c]
  - @graphql-hive/client@0.15.0

## 0.27.5

### Patch Changes

- Updated dependencies [903edf84]
  - @graphql-hive/client@0.14.2

## 0.27.4

### Patch Changes

- Updated dependencies [ff82bd75]
- Updated dependencies [ccb93298]
  - @graphql-hive/client@0.14.1

## 0.27.3

### Patch Changes

- Updated dependencies [fe2b5dbc]
  - @graphql-hive/client@0.14.0

## 0.27.2

### Patch Changes

- fef049c0: Capture exceptions in Urql

## 0.27.1

### Patch Changes

- 95f93830: New service url undefined !== null

## 0.27.0

### Minor Changes

- 845e0880: Trim descriptions

## 0.26.2

### Patch Changes

- c1db1c60: Fix token accessing another token's data in usage checking phase

## 0.26.1

### Patch Changes

- 1623aca5: Upgrade sentry

## 0.26.0

### Minor Changes

- 919fff93: Store schema coordinates in a separate table

## 0.25.0

### Minor Changes

- ffb6feb6: Allow to check usage from multiple targets

## 0.24.4

### Patch Changes

- 3a435baa: Show one value of x-request-id
- Updated dependencies [3a435baa]
  - @hive/service-common@0.1.3

## 0.24.3

### Patch Changes

- 158a33e6: Pass span to schemaPublish and describe CH spans as CH + queryId

## 0.24.2

### Patch Changes

- 96caa261: fix(deps): update dependency agentkeepalive to v4.2.0
- 689610ac: fix(deps): update sentry-javascript monorepo to v6.16.1
- 79d4b4c2: fix(deps): update envelop monorepo
- 8a38ced6: Pass error as second or first
- Updated dependencies [79d4b4c2]
- Updated dependencies [607a4fe2]
  - @graphql-hive/client@0.13.0

## 0.24.1

### Patch Changes

- 1e433ef0: bump

## 0.24.0

### Minor Changes

- 74f8187b: Add failure rate column to operations list

## 0.23.0

### Minor Changes

- b12a7254: Introduce Webhooks service

## 0.22.6

### Patch Changes

- 4e452fd2: Delay only by 250ms minimum

## 0.22.5

### Patch Changes

- 26d6545d: Backoff

## 0.22.4

### Patch Changes

- e3a96531: Increase the overall timeout and bump retry to 6 in CH

## 0.22.3

### Patch Changes

- Updated dependencies [a8485a06]
  - @hive/service-common@0.1.2

## 0.22.2

### Patch Changes

- 2e513bed: Smaller payload

## 0.22.1

### Patch Changes

- 79129085: Bump

## 0.22.0

### Minor Changes

- 747fccdb: Introduces Schema service to validate and build GraphQL schemas

## 0.21.2

### Patch Changes

- c5618186: Send noop post http request to CF worker to test Altinity issue

## 0.21.1

### Patch Changes

- 391b7f47: Use "per target" instead of "per project" message

## 0.21.0

### Minor Changes

- 78f3fd29: Share publication of schema - allows to scale up
- 016dd92c: fix: return SchemaPublishMissingServiceError from Mutation.schemaPublish if the operation selects it and the service name parameter is missing

### Patch Changes

- b3e54d5a: Fixed 'only one service schema...'

## 0.20.6

### Patch Changes

- 82b40d1: Bump to 1s

## 0.20.5

### Patch Changes

- 5fec981: Wait 500ms for lookup, connect and secureConnect before retrying the http request

## 0.20.4

### Patch Changes

- 10b7fff: Try out agent keepalive

## 0.20.3

### Patch Changes

- 7fa2f1c: Multiply timeout by retry number

## 0.20.2

### Patch Changes

- 33fbb5e: Bump

## 0.20.1

### Patch Changes

- 5798314: Single x-request-id header

## 0.20.0

### Minor Changes

- dc8fb96: Introduce base schema

### Patch Changes

- bf78c16: Bump

## 0.19.0

### Minor Changes

- b5966ab: Replace undici with got
- b5966ab: Say hi to TSUP!

### Patch Changes

- Updated dependencies [b5966ab]
  - @graphql-hive/client@0.12.0

## 0.18.6

### Patch Changes

- 5d393f4: Allow to access slack token based on context

## 0.18.5

### Patch Changes

- 31beac1: Dummy bump

## 0.18.4

### Patch Changes

- d0f2a63: Dummy update to test deployment

## 0.18.3

### Patch Changes

- 02b00f0: Update undici, sentry, bullmq
- Updated dependencies [02b00f0]
  - @graphql-hive/client@0.11.1

## 0.18.2

### Patch Changes

- 34d93e9: Mutation.createCdnToken should be accessed with target:registry:read

## 0.18.1

### Patch Changes

- 7549a38: Fix startup

## 0.18.0

### Minor Changes

- 7eca7f0: Introduce access scopes

### Patch Changes

- Updated dependencies [7eca7f0]
  - @graphql-hive/client@0.11.0

## 0.17.3

### Patch Changes

- 52c15e5: Fixes for timeouts?

## 0.17.2

### Patch Changes

- 2f7bc32: Collect default metrics

## 0.17.1

### Patch Changes

- 86909ba: Unmask masked errors that should not be masked

## 0.17.0

### Minor Changes

- 14494fd: Notify user when slack is added

## 0.16.10

### Patch Changes

- d5854ee: Use Inspector@3.0.1

## 0.16.9

### Patch Changes

- 19d4cd5: Bump

## 0.16.8

### Patch Changes

- cc9aa01: Update dependencies
- cc9aa01: Use latest Inspector

## 0.16.7

### Patch Changes

- ac69fb8: Fix #742

## 0.16.6

### Patch Changes

- 65b687e: Batch getSchema calls

## 0.16.5

### Patch Changes

- 9723cc8: Fix patches

## 0.16.4

### Patch Changes

- 4dbb8f0: Fix sentry

## 0.16.3

### Patch Changes

- a3fd1bb: More nested spans

## 0.16.2

### Patch Changes

- db0fe9a: Pass Span to functions wrapped with @sentry decorator

## 0.16.1

### Patch Changes

- 04a18ac: Set lower timeout for ClickHouse queries and set it per query
- 81d8cbc: Create a span for every clickhouse http call attempt

## 0.16.0

### Minor Changes

- 91a6957: Allow to update url of a service

## 0.15.2

### Patch Changes

- c21a099: Share publication of schema between multiple exact same requests

## 0.15.1

### Patch Changes

- Updated dependencies [d67d3e8]
  - @graphql-hive/client@0.10.0

## 0.15.0

### Minor Changes

- 6b62d63: No more ElasticSearch

## 0.14.3

### Patch Changes

- 3d828f4: Use latest Sentry and Sentry NextJS integration
- efd8648: Better handling of x-request-id (also for local env)
- efd8648: Mask errors and doesn't expose any information

## 0.14.2

### Patch Changes

- b15020b: Fixes for double-reporting to Sentry in case of alert error

## 0.14.1

### Patch Changes

- f9b545f: Use missing when only version is not available
- Updated dependencies [f9b545f]
  - @graphql-hive/client@0.9.1

## 0.14.0

### Minor Changes

- 6f204be: Display token info

### Patch Changes

- Updated dependencies [6f204be]
  - @graphql-hive/client@0.9.0

## 0.13.22

### Patch Changes

- 2d8c2ce: Use stable sentry plugin

## 0.13.21

### Patch Changes

- c7a3d24: Gracefully handle Schema Change Notification errors
- b502e9e: Fix issue with conflicting name on target

## 0.13.20

### Patch Changes

- ce155d4: Use orchestrators to build and print schema in Lab
- ce155d4: Skip Sentry for graphql readiness check

## 0.13.19

### Patch Changes

- 9fb90bc: Bump server

## 0.13.18

### Patch Changes

- 07c654b: Do not track readiness introspection queries

## 0.13.17

### Patch Changes

- 34fe260: Logs in project and organization access dataloader

## 0.13.16

### Patch Changes

- eacffea: Exclude readiness check from Sentry transactions

## 0.13.15

### Patch Changes

- 73782cb: Print stringified period object instead of [object Object]

## 0.13.14

### Patch Changes

- 1747d29: Track authorizationa and x-api-token headers in transaction data

## 0.13.13

### Patch Changes

- df6c501: Make Query.lab nullable

## 0.13.12

### Patch Changes

- b358e0a: Allow requests with up to 11mb body size

## 0.13.11

### Patch Changes

- aff0857: Add requestId to logger
- aff0857: Pass x-request-id to responses

## 0.13.10

### Patch Changes

- 080cf71: Fix missing filter

## 0.13.9

### Patch Changes

- 7c5c710: Show stats for client versions

## 0.13.8

### Patch Changes

- c1dd4e6: Stop Sentry from hiding user id

## 0.13.7

### Patch Changes

- 0f8d7b7: Make No Access error more descriptive

## 0.13.6

### Patch Changes

- 249e484: Use json()

## 0.13.5

### Patch Changes

- 05d0140: Use @theguild/buddy
- 052fc32: Use replicas

## 0.13.4

### Patch Changes

- 5f99c67: Batch getOrganizationOwner calls (homemade dataloader)

## 0.13.3

### Patch Changes

- 88fe4b6: Show more data in admin stats

## 0.13.2

### Patch Changes

- 7f2b355: Parse total number

## 0.13.1

### Patch Changes

- 4ee9a3b: Fix operations count

## 0.13.0

### Minor Changes

- efd7b74: Admin panel

## 0.12.3

### Patch Changes

- 49ccd19: Fix field stats

## 0.12.2

### Patch Changes

- fa58c17: Months are zero-based...

## 0.12.1

### Patch Changes

- a835491: Fix conditions in field stats

## 0.12.0

### Minor Changes

- 54f5870: Use ClickHouse already to show data from recent 20 days

## 0.11.0

### Minor Changes

- 5a46b7e: Collect data from operations_new and materialized views

## 0.10.6

### Patch Changes

- bd24700: Add elapsed metric

## 0.10.5

### Patch Changes

- 8434d44: Use Histogram

## 0.10.4

### Patch Changes

- 45c30d0: Fix metrics

## 0.10.3

### Patch Changes

- 23fc805: Fix missing comma :)

## 0.10.2

### Patch Changes

- 51f54f3: Fix missing query label

## 0.10.1

### Patch Changes

- 066824a: Log ClickHouse read latency to Prom

## 0.10.0

### Minor Changes

- 889368b: Bump

## 0.9.0

### Minor Changes

- 11e6800: Allow multiple auth providers and add displayName and fullName to profiles

## 0.8.1

### Patch Changes

- ea7b7f9: Do not track resolvers in Sentry
- ea7b7f9: Use compression

## 0.8.0

### Minor Changes

- 0527e3c: Support Envelop 1.0

### Patch Changes

- 4647d25: Dynamically calculate windows for operations data based on resolution
- 0527e3c: Update Sentry
- a111e68: Update link to a commit in Slack notification
- 0527e3c: Add serverName tag to Sentry.init
- 0527e3c: Update undici
- Updated dependencies [0527e3c]
- Updated dependencies [0527e3c]
  - @graphql-hive/client@0.8.0

## 0.7.23

### Patch Changes

- bde9548: Introduce Query.schemaVersion

## 0.7.22

### Patch Changes

- Updated dependencies [0e712c7]
  - @graphql-hive/client@0.7.0

## 0.7.21

### Patch Changes

- Updated dependencies [e09f95a]
  - @graphql-hive/client@0.6.3

## 0.7.20

### Patch Changes

- Updated dependencies [074c052]
  - @graphql-hive/client@0.6.2

## 0.7.19

### Patch Changes

- Updated dependencies [38bfd02]
  - @graphql-hive/client@0.6.1

## 0.7.18

### Patch Changes

- 23636de: No longer require target selector when fetching latest schema version (we use API Token there anyway)
- 23636de: Store single schema and multiple schemas in CDN (with details)
- 23636de: Remove Identifier from the CDN
- 23636de: Store supergraph in CDN
- Updated dependencies [23636de]
- Updated dependencies [23636de]
- Updated dependencies [23636de]
- Updated dependencies [23636de]
  - @graphql-hive/client@0.6.0

## 0.7.17

### Patch Changes

- 3d4852c: Update urql and codegen

## 0.7.16

### Patch Changes

- 9295075: Bump

## 0.7.15

### Patch Changes

- 1ac74a4: Fix timezone mismatch between App, Api and ClickHouse

## 0.7.14

### Patch Changes

- aa4e661: Bump Undici
- Updated dependencies [aa4e661]
  - @graphql-hive/client@0.5.3

## 0.7.13

### Patch Changes

- fb3efda: Use defer in general operations stats query

## 0.7.12

### Patch Changes

- 34fd1f0: Fix syntax error in failuresOverTime query
- 1cb18e5: Track queries in Sentry

## 0.7.11

### Patch Changes

- 6e75bd1: Fix incorrect number of errors over time

## 0.7.10

### Patch Changes

- 2fbbf66: Fix timeouts

## 0.7.9

### Patch Changes

- 9006b6e: Fix missing json parsing in TokensStorage

## 0.7.8

### Patch Changes

- 36baac7: Fix JSON parsing of non-json responses

## 0.7.7

### Patch Changes

- 356760f: Make Sentry capture exception only on last attempt

## 0.7.6

### Patch Changes

- 48d482e: Retry ClickHouse on error

## 0.7.5

### Patch Changes

- e0a47fb: Use Undici instead of Got and Agentkeepalive
- Updated dependencies [e0a47fb]
  - @graphql-hive/client@0.5.2

## 0.7.4

### Patch Changes

- fb9575f: Track more error details and set timeouts

## 0.7.3

### Patch Changes

- 5ff2e7a: Bump
- 8627a9e: Fix fastify hooks

## 0.7.2

### Patch Changes

- 8f62c26: Update fastify

## 0.7.1

### Patch Changes

- 8a9fdd7: The has method returns true on staled values - tiny-lru
- Updated dependencies [8a9fdd7]
  - @graphql-hive/client@0.5.1

## 0.7.0

### Minor Changes

- d7348a3: Hide literals and remove aliases
- d7348a3: Use ClickHouse next to ElasticSearch

### Patch Changes

- d7348a3: Check only once every 30 days if target has collected ops
- d7348a3: Set dynamic TTL based on expires_at column
- d7348a3: Reuse TCP connections
- Updated dependencies [d7348a3]
  - @graphql-hive/client@0.5.0

## 0.6.17

### Patch Changes

- b010137: Update Sentry to 6.10.0

## 0.6.16

### Patch Changes

- 7e944f2: Use less filters
- abd3d3e: Use p75, p90, p95 and p99 only

## 0.6.15

### Patch Changes

- 0bfe9c1: Improve percentiles calculation by 70% using HDR algorithm

## 0.6.14

### Patch Changes

- 0c59f14: use composite aggregation to show all clients
- 0c59f14: Use filters instead of must conditions

## 0.6.13

### Patch Changes

- 6214042: Better error when invalid token is provided

## 0.6.12

### Patch Changes

- 11b3eb9: Added CDN using CF

## 0.6.11

### Patch Changes

- Updated dependencies [db2c1c3]
- Updated dependencies [4e9f0aa]
  - @hive/service-common@0.1.1

## 0.6.10

### Patch Changes

- Updated dependencies [6ed9bf2]
- Updated dependencies [588285c]
  - @hive/service-common@0.1.0

## 0.6.9

### Patch Changes

- cdbb7b1: Collect ElasticSearch query in case of an error
- 2576e63: Simplify OperationsCollector.countFields and make it faster by 50%"

## 0.6.8

### Patch Changes

- Updated dependencies [ee6b82b]
  - @graphql-hive/client@0.4.5

## 0.6.7

### Patch Changes

- dae2b90: Add operations filter to operations stats page

## 0.6.6

### Patch Changes

- e7fe3df: @cache related fixes

## 0.6.5

### Patch Changes

- bda322c: Use schema:check in our CI

## 0.6.4

### Patch Changes

- 4bc83be: Use HEAD and GET for healthchecks
- 4bc83be: Node 16

## 0.6.3

### Patch Changes

- a73e5cb: Expose GraphQL API healthcheck
- Updated dependencies [a73e5cb]
  - @graphql-hive/client@0.4.4

## 0.6.2

### Patch Changes

- 9b1425f: Send alerts only for relevant targets
- 93674cf: Update Sentry to 6.7.0
- 3e16adb: Attach originalError to captured expection by Sentry and set sql and values from Slonik

## 0.6.1

### Patch Changes

- 5aa5e93: Bump
- Updated dependencies [5aa5e93]
  - @graphql-hive/client@0.4.3

## 0.6.0

### Minor Changes

- 87e3d2e: Alerts, yay!

### Patch Changes

- 968614d: Fix persisting the same query twice
- Updated dependencies [968614d]
  - @graphql-hive/client@0.4.2

## 0.5.4

### Patch Changes

- 1a16360: Collect GraphQL Client name and version
- Updated dependencies [1a16360]
  - @graphql-hive/client@0.4.1

## 0.5.3

### Patch Changes

- 41a9117: Fix an issue when publishing a schema for the first time

## 0.5.2

### Patch Changes

- 203c563: Use "experiment" as the default branch instead of "development"

## 0.5.1

### Patch Changes

- 4224cb9: Add info with a link to documentation on missing data
- c6ef3d2: Bob update
- Updated dependencies [c6ef3d2]
- Updated dependencies [4224cb9]
  - @graphql-hive/client@0.4.0

## 0.5.0

### Minor Changes

- 143fa32: Added Schema Laboratory

## 0.4.6

### Patch Changes

- e65b9cc: Do not set \$created when updating user profile

## 0.4.5

### Patch Changes

- 26dc80e: Fix issues with proxy setup

## 0.4.4

### Patch Changes

- 148b294: Fix issues with undici headers timeout
- Updated dependencies [148b294]
  - @graphql-hive/client@0.3.3

## 0.4.3

### Patch Changes

- 2ebac11: Use externalAuthUserId when creating a user

## 0.4.2

### Patch Changes

- 85b85d4: Dependencies update, cleanup, ui fixes
- Updated dependencies [85b85d4]
  - @graphql-hive/client@0.3.2

## 0.4.1

### Patch Changes

- 9b14d18: Bump

## 0.4.0

### Minor Changes

- 36097a6: Add mixpanel

## 0.3.7

### Patch Changes

- Updated dependencies [a19fef4]
  - @graphql-hive/client@0.3.1

## 0.3.6

### Patch Changes

- Updated dependencies [1fe62bb]
  - @graphql-hive/client@0.3.0

## 0.3.5

### Patch Changes

- 4a7c569: Move operation hashing to Usage service
- Updated dependencies [4a7c569]
  - @graphql-hive/client@0.2.2

## 0.3.4

### Patch Changes

- 6d528a3: Use composite aggregation to show more than 10 records

## 0.3.3

### Patch Changes

- dbcfa69: Split operations stats query into smaller queries (looks WAY better)

## 0.3.2

### Patch Changes

- 824a403: Duration over time stats
- Updated dependencies [5ca6a06]
- Updated dependencies [f96cfc9]
  - @graphql-hive/client@0.2.1

## 0.3.1

### Patch Changes

- bb5b3c4: Preparations for persisted operations in Lance
- Updated dependencies [30da7e7]
- Updated dependencies [bb5b3c4]
  - @graphql-hive/client@0.2.0

## 0.3.0

### Minor Changes

- acab74b: Added support for persisted operations - Changes made in API, APP, CLI, Server, Storage

## 0.2.1

### Patch Changes

- 0873fba: Use logarithim scale in latency histogram

## 0.2.0

### Minor Changes

- c507159: Redesign, fixes, different structure of components and RPM over time

## 0.1.35

### Patch Changes

- c591b5b: Distribution of latency
- ba5f690: Show requests per minute

## 0.1.34

### Patch Changes

- 3c72c34: Percentiles per operation

## 0.1.33

### Patch Changes

- ec400f8: Show failures over time
- e62e498: Fix conditional breaking changes
- a471c88: Support percentiles of request duration

## 0.1.32

### Patch Changes

- @graphql-hive/client@0.1.3

## 0.1.31

### Patch Changes

- Updated dependencies [e1f9e1e]
- Updated dependencies [02322e7]
- Updated dependencies [8585fd8]
  - @graphql-hive/client@0.1.2

## 0.1.30

### Patch Changes

- 4a1de8c: Change windows and add min/max to xAxis

## 0.1.29

### Patch Changes

- f6d2ca6: bump

## 0.1.28

### Patch Changes

- 6e68e25: More stats

## 0.1.27

### Patch Changes

- 23e19fe: Add Requests Over Time plot

## 0.1.26

### Patch Changes

- ed8b326: Show simple stats

## 0.1.25

### Patch Changes

- b33bf11: List of collected operations

## 0.1.24

### Patch Changes

- 67660b1: Bump
- c083cb6: Use SENTRY_DSN

## 0.1.23

### Patch Changes

- Updated dependencies [5135307]
  - @graphql-hive/client@0.1.1

## 0.1.22

### Patch Changes

- 7113a0e: Update Sentry to 6.3.5
- Updated dependencies [7113a0e]
- Updated dependencies [7113a0e]
- Updated dependencies [078e758]
- Updated dependencies [65cc5b5]
  - @graphql-hive/client@0.1.0

## 0.1.21

### Patch Changes

- 7dca692: No longer generate x-request-id

## 0.1.20

### Patch Changes

- d485371: Use trustProxy

## 0.1.19

### Patch Changes

- e43375f: Test deployment

## 0.1.18

### Patch Changes

- Updated dependencies [fd38851]
- Updated dependencies [32f198b]
  - @graphql-hive/client@0.0.8

## 0.1.17

### Patch Changes

- Updated dependencies [eedbad6]
  - @graphql-hive/client@0.0.7

## 0.1.16

### Patch Changes

- ab5c204: Collect more with Sentry
- Updated dependencies [ab5c204]
  - @graphql-hive/client@0.0.6

## 0.1.15

### Patch Changes

- 3a03b35: Fix release id and LOG_LEVEL debug
- cbae6ce: Capture errors on resolver-level

## 0.1.14

### Patch Changes

- 6633f2b: Share x-request-id with tokens

## 0.1.13

### Patch Changes

- df4abcb: Enable Sentry only in prod

## 0.1.12

### Patch Changes

- 741c92f: just test for triggering deployment ci

## 0.1.11

### Patch Changes

- 932de99: Do not track health and readiness checks

## 0.1.10

### Patch Changes

- 93fbf26: Use Sentry Tracing

## 0.1.9

### Patch Changes

- a4970d0: Fix ENVIRONMENT

## 0.1.8

### Patch Changes

- 7bfdb93: Use Sentry to track performance

## 0.1.7

### Patch Changes

- 2269c61: No extra calls to Auth0
- Updated dependencies [2269c61]
  - @graphql-hive/client@0.0.5

## 0.1.6

### Patch Changes

- Updated dependencies [d64a3c5]
  - @graphql-hive/client@0.0.4

## 0.1.5

### Patch Changes

- c1e705a: bump

## 0.1.4

### Patch Changes

- 7e88e71: bump
- Updated dependencies [7e88e71]
  - @graphql-hive/client@0.0.3

## 0.1.3

### Patch Changes

- b2d686e: bump
- Updated dependencies [b2d686e]
  - @graphql-hive/client@0.0.2

## 0.1.2

### Patch Changes

- 9da6738: bump

## 0.1.1

### Patch Changes

- e8cb071: fix issues with ncc packages
