# @graphql-hive/client

## 0.28.1

### Patch Changes

- [#3809](https://github.com/kamilkisiela/graphql-hive/pull/3809) [`b5d1061`](https://github.com/kamilkisiela/graphql-hive/commit/b5d10611ab0c6379d5f141d57798f718e1826a98) Thanks [@n1ru4l](https://github.com/n1ru4l)! - Do not report operations that do not pass GraphQL validation.

## 0.28.0

### Minor Changes

- [#3608](https://github.com/kamilkisiela/graphql-hive/pull/3608) [`daf9eaa`](https://github.com/kamilkisiela/graphql-hive/commit/daf9eaa4b26a247930ec88593fc64e1d7753fae1) Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Changed `exclude` argument type to accept RegEX

## 0.27.0

### Minor Changes

- [#3331](https://github.com/kamilkisiela/graphql-hive/pull/3331)
  [`dad9206`](https://github.com/kamilkisiela/graphql-hive/commit/dad92067ff3d15818dd43671609bcda54c38f913)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add atLeastOnceSampler

- [#3331](https://github.com/kamilkisiela/graphql-hive/pull/3331)
  [`dad9206`](https://github.com/kamilkisiela/graphql-hive/commit/dad92067ff3d15818dd43671609bcda54c38f913)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Introduce sampler for dynamic sampling

## 0.26.0

### Minor Changes

- [#3263](https://github.com/kamilkisiela/graphql-hive/pull/3263)
  [`7924ddcd`](https://github.com/kamilkisiela/graphql-hive/commit/7924ddcd3012916d85c5f7c543b7aa80ed5ca21b)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Allow to pass http and https agents

## 0.25.0

### Minor Changes

- [#3215](https://github.com/kamilkisiela/graphql-hive/pull/3215)
  [`c8ec151e`](https://github.com/kamilkisiela/graphql-hive/commit/c8ec151e5dc2f7c262a5fac9119561c5ca8c63d7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Remove unused persisted operations feature.

### Patch Changes

- [#3237](https://github.com/kamilkisiela/graphql-hive/pull/3237)
  [`e632cd1`](https://github.com/kamilkisiela/graphql-hive/commit/e632cd1529db194899c14eca70e3c8de929f2215)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Update `axios` range to address security
  issues (https://security.snyk.io/vuln/SNYK-JS-AXIOS-6032459)

- [#3160](https://github.com/kamilkisiela/graphql-hive/pull/3160)
  [`2c16c211`](https://github.com/kamilkisiela/graphql-hive/commit/2c16c2114782b06001e99f6ec68b1ec4856a4973)
  Thanks [@renovate](https://github.com/apps/renovate)! - Bump @envelop/types dependency version
  (v5)

## 0.24.3

### Patch Changes

- [#3017](https://github.com/kamilkisiela/graphql-hive/pull/3017)
  [`6023be2`](https://github.com/kamilkisiela/graphql-hive/commit/6023be2a0bcd18c59d85c819ad6604b89484a6fc)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Do not collect usage when Apollo Server
  did not resolve source

- [#3007](https://github.com/kamilkisiela/graphql-hive/pull/3007)
  [`024f68ad`](https://github.com/kamilkisiela/graphql-hive/commit/024f68ad9dbeb10eaa5c17ad1f62f8c725f1d6d7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Finish measuring duration on error

- [#3007](https://github.com/kamilkisiela/graphql-hive/pull/3007)
  [`024f68ad`](https://github.com/kamilkisiela/graphql-hive/commit/024f68ad9dbeb10eaa5c17ad1f62f8c725f1d6d7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Include operation's name in error
  message

- [#3007](https://github.com/kamilkisiela/graphql-hive/pull/3007)
  [`024f68ad`](https://github.com/kamilkisiela/graphql-hive/commit/024f68ad9dbeb10eaa5c17ad1f62f8c725f1d6d7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Detect unavailable definition and throw
  errors with paths pointing to relevant ASTNodes

## 0.24.2

### Patch Changes

- [#2979](https://github.com/kamilkisiela/graphql-hive/pull/2979)
  [`fa18b0a`](https://github.com/kamilkisiela/graphql-hive/commit/fa18b0a36b67a26479cad4fad63cabcaf58e1c1b)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Detect missing DocumentNode in Apollo
  Server

## 0.24.1

### Patch Changes

- [#2543](https://github.com/kamilkisiela/graphql-hive/pull/2543)
  [`0a41288d`](https://github.com/kamilkisiela/graphql-hive/commit/0a41288d4ebcfa8d38726c619882a4f1ab0774da)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Internal refactor for re-using existing code.

## 0.24.0

### Minor Changes

- [#2439](https://github.com/kamilkisiela/graphql-hive/pull/2439)
  [`c7cdeb73`](https://github.com/kamilkisiela/graphql-hive/commit/c7cdeb73f63dca4e3d795f92b0cf2641f592c733)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `useYogaHive` plugin for better integration
  with GraphQL Yoga.

## 0.23.1

### Patch Changes

- [#1357](https://github.com/kamilkisiela/graphql-hive/pull/1357)
  [`9fc97488`](https://github.com/kamilkisiela/graphql-hive/commit/9fc97488cf6da479a63c4d68c6cfae1f3526f8f9)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Remove `Query._entities` when
  extracting original SDL from Fed v2

## 0.23.0

### Minor Changes

- [#1305](https://github.com/kamilkisiela/graphql-hive/pull/1305)
  [`cdf2e8a7`](https://github.com/kamilkisiela/graphql-hive/commit/cdf2e8a77eb1e98f7b90c7ac82ad663bda5784ef)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support Federation v2 in schema
  reporting

- [#1224](https://github.com/kamilkisiela/graphql-hive/pull/1224)
  [`cf14c18d`](https://github.com/kamilkisiela/graphql-hive/commit/cf14c18d6ebf7751f6bec37f82fa643306b538f6)
  Thanks [@rperryng](https://github.com/rperryng)! - skip directive arguments during usage
  collection

- [#1305](https://github.com/kamilkisiela/graphql-hive/pull/1305)
  [`cdf2e8a7`](https://github.com/kamilkisiela/graphql-hive/commit/cdf2e8a77eb1e98f7b90c7ac82ad663bda5784ef)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add @apollo/server and @envelop/types
  as optional dependencies

- [#1305](https://github.com/kamilkisiela/graphql-hive/pull/1305)
  [`cdf2e8a7`](https://github.com/kamilkisiela/graphql-hive/commit/cdf2e8a77eb1e98f7b90c7ac82ad663bda5784ef)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support @apollo/server

## 0.22.0

### Minor Changes

- [#862](https://github.com/kamilkisiela/graphql-hive/pull/862)
  [`d2aa98a5`](https://github.com/kamilkisiela/graphql-hive/commit/d2aa98a574f191e115bd8fab1f95a7aa5bb17659)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use new CDN endpoint for retrieving the service
  list

- [#971](https://github.com/kamilkisiela/graphql-hive/pull/971)
  [`0abc58b9`](https://github.com/kamilkisiela/graphql-hive/commit/0abc58b9e2ed8b4c7d950ce3f7cba43dfdeff344)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Retry failed requests upon CDN issues.

### Patch Changes

- [#776](https://github.com/kamilkisiela/graphql-hive/pull/776)
  [`e46b5dda`](https://github.com/kamilkisiela/graphql-hive/commit/e46b5ddab84406ea810a9e0f0c08e6149e77468a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use correct default value for 'enabled'.

- [#904](https://github.com/kamilkisiela/graphql-hive/pull/904)
  [`20edc8c5`](https://github.com/kamilkisiela/graphql-hive/commit/20edc8c5e54cd71a726f02f33f9710460fc6d5a0)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Upgrade dependency `axios` to v1

- [#904](https://github.com/kamilkisiela/graphql-hive/pull/904)
  [`20edc8c5`](https://github.com/kamilkisiela/graphql-hive/commit/20edc8c5e54cd71a726f02f33f9710460fc6d5a0)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Upgrade dependency
  `apollo-server-plugin-base`

## 0.21.4

### Patch Changes

- [#710](https://github.com/kamilkisiela/graphql-hive/pull/710)
  [`d0357ee`](https://github.com/kamilkisiela/graphql-hive/commit/d0357ee93ae2bca4d8978d990972204ac2d79521)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Make token optional when Hive is
  disabled

## 0.21.3

### Patch Changes

- [#668](https://github.com/kamilkisiela/graphql-hive/pull/668)
  [`e116841`](https://github.com/kamilkisiela/graphql-hive/commit/e116841a739bfd7f37c4a826544301cf23d61637)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix ESM/CJS issue

- Updated dependencies
  [[`e116841`](https://github.com/kamilkisiela/graphql-hive/commit/e116841a739bfd7f37c4a826544301cf23d61637)]:
  - @graphql-hive/core@0.2.3

## 0.21.2

### Patch Changes

- [#655](https://github.com/kamilkisiela/graphql-hive/pull/655)
  [`2cbf27f`](https://github.com/kamilkisiela/graphql-hive/commit/2cbf27fdc9c18749b8969adb6d1598338762dba2)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add User-Agent header to all http requests

## 0.21.1

### Patch Changes

- [#466](https://github.com/kamilkisiela/graphql-hive/pull/466)
  [`2e036ac`](https://github.com/kamilkisiela/graphql-hive/commit/2e036acc4ce1c27a493e90481bb10f5886c0a00c)
  Thanks [@ardatan](https://github.com/ardatan)! - Update GraphQL Tools packages

## 0.21.0

### Minor Changes

- [#563](https://github.com/kamilkisiela/graphql-hive/pull/563)
  [`d58a470`](https://github.com/kamilkisiela/graphql-hive/commit/d58a470916b213230f495e896fe99ec0baa225e2)
  Thanks [@PabloSzx](https://github.com/PabloSzx)! - Fix createServicesFetcher handling null service
  url

## 0.20.1

### Patch Changes

- [#456](https://github.com/kamilkisiela/graphql-hive/pull/456)
  [`fb9b624`](https://github.com/kamilkisiela/graphql-hive/commit/fb9b624ab80ff39658c9ecd45b55d10d906e15e7)
  Thanks [@dimatill](https://github.com/dimatill)! - (processVariables: true) do not collect input
  when corresponding variable is missing

## 0.20.0

### Minor Changes

- [#499](https://github.com/kamilkisiela/graphql-hive/pull/499)
  [`682cde8`](https://github.com/kamilkisiela/graphql-hive/commit/682cde81092fcb3a55de7f24035be4f2f64abfb3)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add Self-Hosting options

## 0.19.0

### Major Changes

- [#435](https://github.com/kamilkisiela/graphql-hive/pull/435)
  [`a79c253`](https://github.com/kamilkisiela/graphql-hive/commit/a79c253253614e44d01fef411016d353ef8c255e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Use ETag and If-None-Match to save
  bandwidth and improve performance

## 0.18.5

### Patch Changes

- [#399](https://github.com/kamilkisiela/graphql-hive/pull/399)
  [`bd6e500`](https://github.com/kamilkisiela/graphql-hive/commit/bd6e500532ed4878a069883fadeaf3bb00e38aeb)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix the wrong cacheKey from #397

## 0.18.4

### Patch Changes

- [#379](https://github.com/kamilkisiela/graphql-hive/pull/379)
  [`2e7c8f3`](https://github.com/kamilkisiela/graphql-hive/commit/2e7c8f3c94013f890f42ca1054287841478ba7a6)
  Thanks [@dimatill](https://github.com/dimatill)! - Collect input fields from variables (opt-in
  with `processVariables` flag)

## 0.18.3

### Patch Changes

- [#308](https://github.com/kamilkisiela/graphql-hive/pull/308)
  [`5a212f6`](https://github.com/kamilkisiela/graphql-hive/commit/5a212f61f206d7b73f8abf04667480851aa6066e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Avoid marking the same type as used
  twice

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

- 30da7e7: When disabled, run everything in dry mode (only http agent is disabled). This should help
  to catch errors in development.

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
