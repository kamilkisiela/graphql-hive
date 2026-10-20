# @graphql-hive/core

## 0.23.2

### Patch Changes

- [#8726](https://github.com/graphql-hive/console/pull/8726)
  [`e085b8e`](https://github.com/graphql-hive/console/commit/e085b8e1ef7a9197d285b2f3b4264fb47bf1a963)
  Thanks [@jdolle](https://github.com/jdolle)! - Surface the registry's request id on HTTP errors.
  `HTTPResponseError` thrown by the core HTTP client now carries the `x-request-id` the server
  returned, and the CLI prints it as `Request ID` on HTTP error responses (for example a request
  rejected because its body is too large), the same way it already does for GraphQL errors.
  Previously only the client-generated id was visible, which does not match anything on the server.

## 0.23.1

### Patch Changes

- [#8670](https://github.com/graphql-hive/console/pull/8670)
  [`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-7mx3-vvmw-hjmv](https://github.com/advisories/GHSA-7mx3-vvmw-hjmv).

## 0.23.0

### Minor Changes

- [#8556](https://github.com/graphql-hive/console/pull/8556)
  [`0961843`](https://github.com/graphql-hive/console/commit/0961843fdac3b2f9ae0e25d05bc48d25d2c63d4d)
  Thanks [@jdolle](https://github.com/jdolle)! - HTTP requests that fail with an unaccepted status
  code now throw an `HTTPResponseError`, which exposes the response `status` and `statusText`.

### Patch Changes

- [#8565](https://github.com/graphql-hive/console/pull/8565)
  [`e30136b`](https://github.com/graphql-hive/console/commit/e30136baac429d2d77992e693b5a02eab5147977)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Preserve all executable definitions when
  normalizing operation documents for usage reporting.

## 0.22.5

### Patch Changes

- [#8397](https://github.com/graphql-hive/console/pull/8397)
  [`cac2fc2`](https://github.com/graphql-hive/console/commit/cac2fc27162811ef0bc739f05793d273497d04ef)
  Thanks [@jdolle](https://github.com/jdolle)! - Deprecate run-time reporting schemas from `useHive`
  plugin.

  Use Hive CLI (`@graphql-hive/cli`) to publish the schema file instead. This aligns with best
  practices for schema management and prevents an issue where multiple service instances result in
  numerous publishes to Hive.

## 0.22.4

### Patch Changes

- [#8383](https://github.com/graphql-hive/console/pull/8383)
  [`85a3351`](https://github.com/graphql-hive/console/commit/85a33512ed9f03095d376fc586d737ac0183410d)
  Thanks [@jdolle](https://github.com/jdolle)! - Explicitly supports errors thrown in the gateway.
  I.e. authentication during execution.

  This adds a new field to the usage payload that specifically contains errors thrown within the
  gateway. This separates gateway errors from subgraph errors. All errors are currently ingested
  similarly into Clickhouse, but this change supports future improvements to show the source
  (subgraph name or gateway) of errors.

## 0.22.3

### Patch Changes

- [#8329](https://github.com/graphql-hive/console/pull/8329)
  [`33791da`](https://github.com/graphql-hive/console/commit/33791da958f6801d4a981c9147891724f39ef50c)
  Thanks [@jdolle](https://github.com/jdolle)! - Support Rust query planner execution by setting
  default operation root type name in collected payload's "paths" if not returned in subgraph call
  request info.

## 0.22.2

### Patch Changes

- [#8317](https://github.com/graphql-hive/console/pull/8317)
  [`658ff6a`](https://github.com/graphql-hive/console/commit/658ff6a644ef76787d1d283a34eab56c03f8ffa5)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - add missing `tslib` dependency.

## 0.22.1

### Patch Changes

- [#8308](https://github.com/graphql-hive/console/pull/8308)
  [`3dbda7d`](https://github.com/graphql-hive/console/commit/3dbda7dbe895173578cc4c452a85ef6c2ce07383)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix usage collector error catching.

  When async event collection fails, the error is now caught internally and logged rather than
  leaking an unhandled promise rejection that would crash the node application.

## 0.22.0

### Minor Changes

- [#8062](https://github.com/graphql-hive/console/pull/8062)
  [`8270cac`](https://github.com/graphql-hive/console/commit/8270cac6516b20454914ee39d189e8c943487834)
  Thanks [@jdolle](https://github.com/jdolle)! - Add a new experimental config option that allows
  sending additional metrics (errors and resolution counts) to Hive Console.

### Patch Changes

- [#8291](https://github.com/graphql-hive/console/pull/8291)
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use npm trusted publishing.

## 0.21.1

### Patch Changes

- [#8119](https://github.com/graphql-hive/console/pull/8119)
  [`63a9126`](https://github.com/graphql-hive/console/commit/63a912691f0c7e5afdd2cc864de53df289592b54)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Add `manifest` method to
  `createHive(...).persistedDocuments` for fetching a persisted documents (app deployment) manifest

  ```ts
  const hive = createHive({
    persistedDocuments: {
      cdn: {
        endpoint: 'https://cdn.graphql-hive.com/artifacts/v1/<target_id>',
        accessToken: '<cdn_access_token>'
      }
    }
    // ...
  })

  const manifest = await hive.persistedDocuments!.manifest({
    appName: 'my-app',
    appVersion: '1.0.0'
  })

  // null if the app version does not exist, otherwise:
  // {
  //   id: 'some-uuid',          // unique identifier of the manifest
  //   appName: 'my-app',        // app name
  //   appVersion: '1.0.0',      // app version
  //   isActive: true,           // whether this app version is published/active in Hive
  //   documentHashes: [         // all persisted document hashes for this app version
  //     'abc123',
  //     'def456',
  //   ],
  // }
  ```

## 0.21.0

### Minor Changes

- [#7769](https://github.com/graphql-hive/console/pull/7769)
  [`ee2785c`](https://github.com/graphql-hive/console/commit/ee2785c4cc63922bbd45f2557cc6d1e5577c6cca)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - The persisted documents feature is now stable.
  Please use the `persistedDocuments` configuration option instead of
  `experimental__persistedDocuments`.

  ```diff
    useHive({
  -   experimental__persistedDocuments: {
  +   persistedDocuments: {
        cdn: {
          endpoint: 'https://cdn.graphql-hive.com/artifacts/v1/<target_id>',
          accessToken: '<cdn_access_token>'
        },
      },
    })
  ```

## 0.20.2

### Patch Changes

- [#7541](https://github.com/graphql-hive/console/pull/7541)
  [`1f824a7`](https://github.com/graphql-hive/console/commit/1f824a7d503c39d8675fb44e899da275d5ac7045)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Clear persisted documents caches on
  dispose to prevent memory leaks. The `dispose()` function now clears `persistedDocumentsCache` and
  `fetchCache` to allow proper garbage collection.

## 0.20.1

### Patch Changes

- [#7507](https://github.com/graphql-hive/console/pull/7507)
  [`8bbbfb8`](https://github.com/graphql-hive/console/commit/8bbbfb8aa6aa4c59b9ad515dfbbe12616931f82d)
  Thanks [@doronrosenberg](https://github.com/doronrosenberg)! - Update the tiny-lru dependency

## 0.20.0

### Minor Changes

- [#7462](https://github.com/graphql-hive/console/pull/7462)
  [`60133a4`](https://github.com/graphql-hive/console/commit/60133a41a684a0c1b1a45d47cf3cd30cc804c19d)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add Layer 2 (L2) cache support for
  persisted documents.

  This feature adds a second layer of caching between the in-memory cache (L1) and the CDN for
  persisted documents. This is particularly useful for:

  - **Serverless environments**: Where in-memory cache is lost between invocations
  - **Multi-instance deployments**: To share cached documents across server instances
  - **Reducing CDN calls**: By caching documents in Redis or similar external caches

  The lookup flow is: L1 (memory) -> L2 (Redis/external) -> CDN

  **Example with GraphQL Yoga:**

  ```typescript
  import { createYoga } from 'graphql-yoga'
  import { createClient } from 'redis'
  import { useHive } from '@graphql-hive/yoga'

  const redis = createClient({ url: 'redis://localhost:6379' })
  await redis.connect()

  const yoga = createYoga({
    plugins: [
      useHive({
        experimental__persistedDocuments: {
          cdn: {
            endpoint: 'https://cdn.graphql-hive.com/artifacts/v1/<target_id>',
            accessToken: '<cdn_access_token>'
          },
          layer2Cache: {
            cache: {
              get: key => redis.get(`hive:pd:${key}`),
              set: (key, value, opts) =>
                redis.set(`hive:pd:${key}`, value, opts?.ttl ? { EX: opts.ttl } : {})
            },
            ttlSeconds: 3600, // 1 hour for found documents
            notFoundTtlSeconds: 60 // 1 minute for not-found (negative caching)
          }
        }
      })
    ]
  })
  ```

  **Features:**

  - Configurable TTL for found documents (`ttlSeconds`)
  - Configurable TTL for negative caching (`notFoundTtlSeconds`)
  - Graceful fallback to CDN if L2 cache fails
  - Support for `waitUntil` in serverless environments
  - Apollo Server integration auto-uses context cache if available

## 0.19.0

### Minor Changes

- [#7422](https://github.com/graphql-hive/console/pull/7422)
  [`711f4e6`](https://github.com/graphql-hive/console/commit/711f4e6a25ea7806d871554f2949a9ff300a0dbf)
  Thanks [@santino](https://github.com/santino)! - Introduce validation for Persisted Document ID

### Patch Changes

- [#7414](https://github.com/graphql-hive/console/pull/7414)
  [`4f9f988`](https://github.com/graphql-hive/console/commit/4f9f988d62c54f6e7a6820eba1fa9913146dcf9e)
  Thanks [@ardatan](https://github.com/ardatan)! - Support \`graphql-client-name\` and
  \`graphql-client-version\` by default in addition to the existing \`x-graphql-client-name\` and
  \`x-graphql-client-version\` headers

## 0.18.0

### Minor Changes

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add support for providing a logger object via
  `HivePluginOptions`.

  It is possible to provide the following options:

  - **'trace'**
  - **'debug'**
  - **'info'** default
  - **'warn'**
  - **'error'**

  ```ts
  import { createHive } from '@graphql-hive/core'

  const client = createHive({
    logger: 'info'
  })
  ```

  In addition to that, it is also possible to provide a Hive Logger instance, that allows more
  control over how you want to log and forward logs.

  ```ts
  import { createHive } from '@graphql-hive/core'
  import { Logger } from '@graphql-hive/logger'

  const client = createHive({
    logger: new Logger()
  })
  ```

  Head to our [Hive Logger documentation](https://the-guild.dev/graphql/hive/docs/logger) to learn
  more.

  ***

  **The `HivePluginOptions.debug` option is now deprecated.** Instead, please use the `logger`
  option to control logging levels.

  ```diff
   import { createHive } from '@graphql-hive/core'

   const client = createHive({
  -  debug: process.env.DEBUG === "1",
  +  logger: process.env.DEBUG === "1" ? "debug" : "info",
   })
  ```

  **Note**: If the `logger` property is provided, the `debug` option is ignored.

  ***

  **The `HivePluginOptions.agent.logger` option is now deprecated.** Instead, please provide
  `HivePluginOptions.logger`.

  ```diff
   import { createHive } from '@graphql-hive/core'

   const logger = new Logger()

   const client = createHive({
     agent: {
  -    logger,
     },
  +  logger,
   })
  ```

  **Note**: If both options are provided, the `agent` option is ignored.

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **Persisted Documents Improvements**

  Persisted documents now support specifying a mirror endpoint that will be used in case the main
  CDN is unreachable. Provide an array of endpoints to the client configuration.

  ```ts
  import { createClient } from '@graphql-hive/core'

  const client = createClient({
    experimental__persistedDocuments: {
      cdn: {
        endpoint: [
          'https://cdn.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688',
          'https://cdn-mirror.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688'
        ],
        accessToken: ''
      }
    }
  })
  ```

  In addition to that, the underlying logic for looking up documents now uses a circuit breaker. If
  a single endpoint is unreachable, further lookups on that endpoint are skipped.

  The behaviour of the circuit breaker can be customized via the `circuitBreaker` configuration.

  ```ts
  import { createClient } from '@graphql-hive/core'

  const client = createClient({
    experimental__persistedDocuments: {
      cdn: {
        endpoint: [
          'https://cdn.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688',
          'https://cdn-mirror.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688'
        ],
        accessToken: ''
      },
      circuitBreaker: {
        // open circuit if 50 percent of request result in an error
        errorThresholdPercentage: 50,
        // start monitoring the circuit after 10 requests
        volumeThreshold: 10,
        // time before the backend is tried again after the circuit is open
        resetTimeout: 30_000
      }
    }
  })
  ```

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **New CDN Artifact Fetcher**

  We have a new interface for fetching CDN artifacts (such as supergraph and services) with a cache
  from the CDN. This fetcher supports providing a mirror endpoint and comes with a circuit breaker
  under the hood.

  ```ts
  const supergraphFetcher = createCDNArtifactFetcher({
    endpoint: [
      'https://cdn.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688',
      'https://cdn-mirror.graphql-hive.com/artifacts/v1/9fb37bc4-e520-4019-843a-0c8698c25688'
    ],
    accessKey: ''
  })

  supergraphFetcher.fetch()
  ```

  ***

  `createSupergraphSDLFetcher` is now deprecated. Please upgrade to use `createCDNArtifactFetcher`.

## 0.15.1

### Patch Changes

- [#7297](https://github.com/graphql-hive/console/pull/7297)
  [`64c8368`](https://github.com/graphql-hive/console/commit/64c8368c4b94b4ad2178d341442f0a0ffb4013f1)
  Thanks [@ardatan](https://github.com/ardatan)! - Shutdown Circuit Breaker properly while disposing
  Hive Client

## 0.15.0

### Minor Changes

- [#7280](https://github.com/graphql-hive/console/pull/7280)
  [`2cc443c`](https://github.com/graphql-hive/console/commit/2cc443c160e11313c905424b63a7c1362121d8d8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support circuit breaking for usage reporting.

  Circuit breaking is a fault-tolerance pattern that prevents a system from repeatedly calling a
  failing service. When errors or timeouts exceed a set threshold, the circuit “opens,” blocking
  further requests until the service recovers.

  This ensures that during a network issue or outage, the service using the Hive SDK remains healthy
  and is not overwhelmed by failed usage reports or repeated retries.

  ```ts
  import { createClient } from '@graphql-hive/core'

  const client = createClient({
    agent: {
      circuitBreaker: {
        /**
         * Count of requests before starting evaluating.
         * Default: 5
         */
        volumeThreshold: 5,
        /**
         * Percentage of requests failing before the circuit breaker kicks in.
         * Default: 50
         */
        errorThresholdPercentage: 1,
        /**
         * After what time the circuit breaker is attempting to retry sending requests in milliseconds
         * Default: 30_000
         */
        resetTimeout: 10_000
      }
    }
  })
  ```

## 0.14.0

### Minor Changes

- [#7264](https://github.com/graphql-hive/console/pull/7264)
  [`582bc0e`](https://github.com/graphql-hive/console/commit/582bc0e2a4a95d0023d1cdbe627bc6147f82af8e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce debug log level. HTTP retry log pollute
  the error log. The retries are now logged to the debug level. In order to see debug logs set the
  `debug` option to true.

  ```ts
  const hive = createHive({
    debug: true
  })
  ```

  If you are using a custom logger, make sure to provide a `debug` logging method implementation.

  ```ts
  const hive = createHive({
    debug: true,
    agent: {
      logger: {
        info() {},
        error() {},
        debug() {}
      }
    }
  })
  ```

## 0.13.2

### Patch Changes

- [#7253](https://github.com/graphql-hive/console/pull/7253)
  [`43920cd`](https://github.com/graphql-hive/console/commit/43920cdb3d56a54c66c61bbc6ca1cc6af4a7b5ee)
  Thanks [@ardatan](https://github.com/ardatan)! - Allow to provide `version` to `AgentOptions` in
  Hive Client integrations.

  ```ts
  createHive({
    agent: {
      name: 'my-custom-agent',
      version: '1.2.3' // new field
    }
  })
  ```

  Currently you can provide `name` but not `version`. This change allows to provide both `name` and
  `version` to better identify the clients connecting to Hive Console. Previously the dependent
  libraries like Yoga, Envelop and Hive Gateway integrations were incorrectly sending their names
  with the version of `@graphql-hive/core` package. Now they will be able to send their own
  versions.

- [#7253](https://github.com/graphql-hive/console/pull/7253)
  [`43920cd`](https://github.com/graphql-hive/console/commit/43920cdb3d56a54c66c61bbc6ca1cc6af4a7b5ee)
  Thanks [@ardatan](https://github.com/ardatan)! - Accept `name` and `version` to
  `createSupergraphSDLFetcher` to build a more accurate user agent instead of passing `hive-client`
  with `@graphql-hive/core`'s version

## 0.13.1

### Patch Changes

- [#7248](https://github.com/graphql-hive/console/pull/7248)
  [`d8f6e25`](https://github.com/graphql-hive/console/commit/d8f6e252ee3cd22948eb0d64b9d25c9b04dba47c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support project and personal access tokens (`hvp1/`
  and `hvu1/`).

## 0.13.0

### Minor Changes

- [#6876](https://github.com/graphql-hive/console/pull/6876)
  [`8d56b98`](https://github.com/graphql-hive/console/commit/8d56b9848028d65442cb1dada139f5a17d464f1b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add helper function `hashOperation` for generating
  consistent hashes used within the Hive Console platform.

## 0.12.0

### Minor Changes

- [#6764](https://github.com/graphql-hive/console/pull/6764)
  [`bbd5643`](https://github.com/graphql-hive/console/commit/bbd5643924eb2b32511e96a03a3a5a978a66adee)
  Thanks [@jdolle](https://github.com/jdolle)! - Track provided operation arguments/inputs and use
  them to determine conditional breaking changes; Fix null to non-null argument breaking change edge
  case"

## 0.11.0

### Minor Changes

- [#6637](https://github.com/graphql-hive/console/pull/6637)
  [`5130fc1`](https://github.com/graphql-hive/console/commit/5130fc1db8c50ac0eb35d901623594749772c550)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add error logging for invalid combinations of the
  `target` and `token` configuration.

  - Please make sure to provide the `target` option for usage reporting when using a token that
    starts with `hvo1/`.
  - Please make sure to **not** provide a `target` option for usage reporting when a token does
    **not** start with `hvo1/`

## 0.10.1

### Patch Changes

- [#6606](https://github.com/graphql-hive/console/pull/6606)
  [`ee70018`](https://github.com/graphql-hive/console/commit/ee7001883970fac81210ec21ce70a72bfd3b67bb)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Client can be used only for experimental
  persisted documents

- [#6623](https://github.com/graphql-hive/console/pull/6623)
  [`a003f78`](https://github.com/graphql-hive/console/commit/a003f781cb1a38d8b00a3256163c50e3893db5f2)
  Thanks [@ardatan](https://github.com/ardatan)! - Use ranged versions in dependencies to prevent
  multiple versions of the same package

## 0.10.0

### Minor Changes

- [#6574](https://github.com/graphql-hive/console/pull/6574)
  [`494697e`](https://github.com/graphql-hive/console/commit/494697e20f67ef877cd5dd63ccd29984c719ab44)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add support for providing a target for usage
  reporting with organization access tokens. This can either be a slug following the format
  `$organizationSlug/$projectSlug/$targetSlug` (e.g `the-guild/graphql-hive/staging`) or an UUID
  (e.g. `a0f4c605-6541-4350-8cfe-b31f21a4bf80`)

  ```ts
  import { createHive } from '@graphql-hive/core'

  const hive = createHive({
    enabled: true,
    token: 'ORGANIZATION_ACCESS_TOKEN',
    usage: {
      target: 'my-org/my-project/my-target'
    }
  })
  ```

## 0.9.1

### Patch Changes

- [#6494](https://github.com/graphql-hive/console/pull/6494)
  [`ae2d16d`](https://github.com/graphql-hive/console/commit/ae2d16d553e264c813ac65d78eacab3d7a2efeae)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Replace usage of `crypto.randomUUID()` with a
  custom UUID generation for better backwards compatability.

## 0.9.0

### Minor Changes

- [#6488](https://github.com/graphql-hive/console/pull/6488)
  [`f7d65fe`](https://github.com/graphql-hive/console/commit/f7d65feb5aaf4f4f86dfc0fe5df3ea4c3df1d7a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Include and log a `x-request-id` header for all
  requests sent to the Hive API. This helps users to share more context with Hive staff when
  encountering errors.

## 0.8.4

### Patch Changes

- [#6383](https://github.com/graphql-hive/console/pull/6383)
  [`ec356a7`](https://github.com/graphql-hive/console/commit/ec356a7784d1f59722f80a69f501f1f250b2f6b2)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Collect custom scalars from arguments
  and input object fields

## 0.8.3

### Patch Changes

- [#6118](https://github.com/graphql-hive/console/pull/6118)
  [`039c66b`](https://github.com/graphql-hive/console/commit/039c66bd24d4339e56b4e1e1fc7f8fa68de7e954)
  Thanks [@ardatan](https://github.com/ardatan)! - Remove internal `_testing_` option to replace the
  underlying `fetch` implementation, and add `fetch` option to do the same as part of the public
  API.

## 0.8.2

### Patch Changes

- [#5676](https://github.com/graphql-hive/platform/pull/5676)
  [`c728803`](https://github.com/graphql-hive/platform/commit/c7288038f24c0214b4023994f306c6229c1ce72c)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Correct collection of enum values when
  used in a list

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
