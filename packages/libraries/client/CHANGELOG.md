# @graphql-hive/client

## 0.20.1

### Patch Changes

- [#456](https://github.com/kamilkisiela/graphql-hive/pull/456) [`fb9b624`](https://github.com/kamilkisiela/graphql-hive/commit/fb9b624ab80ff39658c9ecd45b55d10d906e15e7) Thanks [@dimatill](https://github.com/dimatill)! - (processVariables: true) do not collect input when corresponding variable is missing

## 0.20.0

### Minor Changes

- [#499](https://github.com/kamilkisiela/graphql-hive/pull/499) [`682cde8`](https://github.com/kamilkisiela/graphql-hive/commit/682cde81092fcb3a55de7f24035be4f2f64abfb3) Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add Self-Hosting options

## 0.19.0

### Major Changes

- [#435](https://github.com/kamilkisiela/graphql-hive/pull/435) [`a79c253`](https://github.com/kamilkisiela/graphql-hive/commit/a79c253253614e44d01fef411016d353ef8c255e) Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Use ETag and If-None-Match to save bandwidth and improve performance

## 0.18.5

### Patch Changes

- [#399](https://github.com/kamilkisiela/graphql-hive/pull/399) [`bd6e500`](https://github.com/kamilkisiela/graphql-hive/commit/bd6e500532ed4878a069883fadeaf3bb00e38aeb) Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix the wrong cacheKey from #397

## 0.18.4

### Patch Changes

- [#379](https://github.com/kamilkisiela/graphql-hive/pull/379) [`2e7c8f3`](https://github.com/kamilkisiela/graphql-hive/commit/2e7c8f3c94013f890f42ca1054287841478ba7a6) Thanks [@dimatill](https://github.com/dimatill)! - Collect input fields from variables (opt-in with `processVariables` flag)

## 0.18.3

### Patch Changes

- [#308](https://github.com/kamilkisiela/graphql-hive/pull/308) [`5a212f6`](https://github.com/kamilkisiela/graphql-hive/commit/5a212f61f206d7b73f8abf04667480851aa6066e) Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Avoid marking the same type as used twice

## 0.18.2

### Patch Changes

- ef18a38: Show error messages when publishing the schema

## 0.18.1

### Patch Changes

- c0e0821: fix: enabled false will log in debug that hive is disabled

## 0.18.0

### Minor Changes

- a94fd68: Introduce createSupergraphManager for @apollo/gateway v2

## 0.17.0

### Minor Changes

- 25d6b01: Migrate to Authorization header (previously X-API-Token)

## 0.16.0

### Minor Changes

- 52bebed: Raise an error on missing commit, author or token options.

## 0.15.4

### Patch Changes

- ad66973: Bump
- Updated dependencies [ad66973]
  - @graphql-hive/core@0.2.2

## 0.15.3

### Patch Changes

- 0a5dbeb: Point to graphql-hive.com
- Updated dependencies [0a5dbeb]
  - @graphql-hive/core@0.2.1

## 0.15.2

### Patch Changes

- a33cdcef: Update link to documentation

## 0.15.1

### Patch Changes

- cd998fab: add readme

## 0.15.0

### Minor Changes

- ac9b868c: Support GraphQL v16

### Patch Changes

- Updated dependencies [ac9b868c]
  - @graphql-hive/core@0.2.0

## 0.14.2

### Patch Changes

- 903edf84: Bump

## 0.14.1

### Patch Changes

- ff82bd75: Improve scheduling
- ccb93298: Remove content-encoding header and improve error logs

## 0.14.0

### Minor Changes

- fe2b5dbc: Introduce new reporting format and set maxSize to 1500

## 0.13.0

### Minor Changes

- 607a4fe2: Support new Apollo Server Plugin V3 next to V0

### Patch Changes

- 79d4b4c2: fix(deps): update envelop monorepo

## 0.12.0

### Minor Changes

- b5966ab: Replace undici with axios

## 0.11.1

### Patch Changes

- 02b00f0: Update undici, sentry, bullmq

## 0.11.0

### Minor Changes

- 7eca7f0: Display access to actions

## 0.10.0

### Minor Changes

- d67d3e8: Add schema and services fetchers for gateways other than Apollo Gateway

## 0.9.1

### Patch Changes

- f9b545f: Send version of Hive client

## 0.9.0

### Minor Changes

- 6f204be: Display token info

## 0.8.0

### Minor Changes

- 0527e3c: Support Envelop 1.0

### Patch Changes

- 0527e3c: Update undici

## 0.7.0

### Minor Changes

- 0e712c7: Normalize operations and remove literals before sending them to Hive

## 0.6.3

### Patch Changes

- e09f95a: Bump version

## 0.6.2

### Patch Changes

- 074c052: Fix supergraph fetcher not being a function

## 0.6.1

### Patch Changes

- 38bfd02: Export createSupergraphSDLFetcher

## 0.6.0

### Minor Changes

- 23636de: Support Federation Gateway (polling and supergraph)

### Patch Changes

- 23636de: Support federated services when reporting schema
- 23636de: Fix missing directives, service name and service url when reporting the schema
- 23636de: Compress with gzip

## 0.5.3

### Patch Changes

- aa4e661: Bump Undici

## 0.5.2

### Patch Changes

- e0a47fb: Use Undici instead of Got and Agentkeepalive

## 0.5.1

### Patch Changes

- 8a9fdd7: The has method returns true on staled values - tiny-lru

## 0.5.0

### Minor Changes

- d7348a3: Collect timestamps

## 0.4.5

### Patch Changes

- ee6b82b: Bump undici to stable v4

## 0.4.4

### Patch Changes

- a73e5cb: Warn about missing token

## 0.4.3

### Patch Changes

- 5aa5e93: Bump

## 0.4.2

### Patch Changes

- 968614d: Much more explanatory messages in Agent

## 0.4.1

### Patch Changes

- 1a16360: Send GraphQL Client name and version

## 0.4.0

### Minor Changes

- 4224cb9: Move author and commit under reporting and token to top level of options

### Patch Changes

- c6ef3d2: Bob update

## 0.3.3

### Patch Changes

- 148b294: Fix issues with undici headers timeout

## 0.3.2

### Patch Changes

- 85b85d4: Dependencies update, cleanup, ui fixes

## 0.3.1

### Patch Changes

- a19fef4: Fix missing document in Apollo

## 0.3.0

### Minor Changes

- 1fe62bb: Apollo Plugin

## 0.2.2

### Patch Changes

- 4a7c569: Move operation hashing to Usage service

## 0.2.1

### Patch Changes

- 5ca6a06: Move debug to top level
- f96cfc9: Add hash to usage collector and allow for custom logic

## 0.2.0

### Minor Changes

- 30da7e7: When disabled, run everything in dry mode (only http agent is disabled). This should help to catch errors in development.

### Patch Changes

- bb5b3c4: Preparations for persisted operations in Lance

## 0.1.3

### Patch Changes

- Updated dependencies [6b74355]
  - @graphql-hive/core@0.0.3

## 0.1.2

### Patch Changes

- e1f9e1e: Use normalization
- 02322e7: Collect execution info
- 8585fd8: Collect error path
- Updated dependencies [094c861]
  - @graphql-hive/core@0.0.2

## 0.1.1

### Patch Changes

- 5135307: Collect client info

## 0.1.0

### Minor Changes

- 078e758: Token per Target

### Patch Changes

- 7113a0e: Custom logger
- 7113a0e: Add dispose method
- 65cc5b5: Collect arguments

## 0.0.8

### Patch Changes

- fd38851: Add try/catch on top of report/usage
- 32f198b: Enabled flag

## 0.0.7

### Patch Changes

- eedbad6: Make ttl and max optional

## 0.0.6

### Patch Changes

- ab5c204: Collect more with Sentry

## 0.0.5

### Patch Changes

- 2269c61: No extra calls to Auth0

## 0.0.4

### Patch Changes

- d64a3c5: Target 2017

## 0.0.3

### Patch Changes

- 7e88e71: bump

## 0.0.2

### Patch Changes

- b2d686e: bump
