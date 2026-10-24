# hive

## 14.1.2

### Patch Changes

- [#8768](https://github.com/graphql-hive/console/pull/8768)
  [`e93f335`](https://github.com/graphql-hive/console/commit/e93f3359371464f54a454a1994eb563299c5009d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support using AWS IAM credentials for S3 access
  from the artifacts Lambda instead of static access keys.

  To use the Lambda execution role, grant it `s3:GetObject` access to the artifact bucket and
  configure the Lambda environment variables as follows:

  ```sh
  AWS_S3_IAM_AUTH_ENABLED=1
  AWS_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
  AWS_S3_BUCKET_NAME=my-artifacts-bucket
  ```

- [#8763](https://github.com/graphql-hive/console/pull/8763)
  [`8b21b39`](https://github.com/graphql-hive/console/commit/8b21b39d968773ac87e26ad73562062db973e75b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Bump Node.js version from
  [`24.22.0`](https://nodejs.org/en/blog/release/v24.22.0) to
  [`24.22.1`](https://nodejs.org/en/blog/release/v24.22.1). Address
  [disclosed vulnerabilities](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

- [#8765](https://github.com/graphql-hive/console/pull/8765)
  [`8b4c2ea`](https://github.com/graphql-hive/console/commit/8b4c2ea8936cf4d11b5b43ccdfc00827a83c72a3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Strip whitespace from oidc related urls and trim
  them when updating/creating an integration to avoid broker request failures.

- [#8763](https://github.com/graphql-hive/console/pull/8763)
  [`8b21b39`](https://github.com/graphql-hive/console/commit/8b21b39d968773ac87e26ad73562062db973e75b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8),
  [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c), and
  [GHSA-gfr2-rv44-r23c](https://github.com/advisories/GHSA-gfr2-rv44-r23c).

- [#8775](https://github.com/graphql-hive/console/pull/8775)
  [`ca1cb72`](https://github.com/graphql-hive/console/commit/ca1cb7261076dfe69659d1fa891064cf71e66c3f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address
  [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7).

- [#8754](https://github.com/graphql-hive/console/pull/8754)
  [`2fe05b9`](https://github.com/graphql-hive/console/commit/2fe05b9268dc9d906819afbc20c5d79b0f5552f2)
  Thanks [@jdolle](https://github.com/jdolle)! - Schema publish now returns a `SchemaPublishError`
  instead of a generic error when the request has no schema source or both `sdl` and `schema`, when
  the SDL cannot be parsed, or when the metadata is not valid JSON.

- [#8766](https://github.com/graphql-hive/console/pull/8766)
  [`2c6998b`](https://github.com/graphql-hive/console/commit/2c6998bca0a0c5514866720521fc2ae2f6134cd4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use trace span names prefixed with `hive_console.`
  instead of `hive.` to avoid confusion with gateway hive sdk span attributes.

## 14.1.1

### Patch Changes

- [#8749](https://github.com/graphql-hive/console/pull/8749)
  [`95c2ad4`](https://github.com/graphql-hive/console/commit/95c2ad404f69cf8ecbfe42884ae38b6689102b83)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve schema check data loading performance.

- [#8756](https://github.com/graphql-hive/console/pull/8756)
  [`2f51407`](https://github.com/graphql-hive/console/commit/2f51407d2c819103d8c238c424834262ee144738)
  Thanks [@jdolle](https://github.com/jdolle)! - Bound the ClickHouse insert of persisted documents
  by the upload's abort signal (55 s fallback) instead of a fixed 30 s request timeout, send a query
  id with it so server-side logs can be matched to traces, and stop re-sending a batch after a
  timeout: with asynchronous inserts the first copy is already buffered server-side, so a retry
  stored it twice. The `addPreprocessedDocumentsToAppDeployment` path now has the same 50 s budget
  as the worker path.

- [#8752](https://github.com/graphql-hive/console/pull/8752)
  [`0b844b3`](https://github.com/graphql-hive/console/commit/0b844b3dda0a4af4b1d77077ca632bd132ea817f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Increase the timeout for writing persisted
  documents to clickhouse.

- [#8748](https://github.com/graphql-hive/console/pull/8748)
  [`8ee6aa4`](https://github.com/graphql-hive/console/commit/8ee6aa4de4119d6fc932e8cd56c58864297e59e2)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve performance of loading schema history from
  the database.

- [#8757](https://github.com/graphql-hive/console/pull/8757)
  [`9224191`](https://github.com/graphql-hive/console/commit/922419170743e5b000332948968785aac067c67b)
  Thanks [@jdolle](https://github.com/jdolle)! - Persisted documents are written to ClickHouse with
  a synchronous insert. A batch no longer joins the server-wide asynchronous insert queue, where it
  was coalesced with other uploads and waited behind other tables' flushes; its latency and memory
  are now those of its own rows.

- [#8750](https://github.com/graphql-hive/console/pull/8750)
  [`57edffb`](https://github.com/graphql-hive/console/commit/57edffbda9e91dab42626149dba7893ad0c45639)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add authenticated actor and resource identifiers to
  request traces.

## 14.1.0

### Minor Changes

- [#8679](https://github.com/graphql-hive/console/pull/8679)
  [`bd8f0f2`](https://github.com/graphql-hive/console/commit/bd8f0f211e5e5fdebe84ad2093b9f7087cc8a3a5)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Record which targets a breaking
  change was used in. Schema checks and publishes with conditional breaking changes now store
  per-target request counts for each breaking change and for each of its top affected operations,
  exposed as `affectedTargets` on `SchemaChangeUsageStatistics` and
  `SchemaChangeUsageStatisticsAffectedOperation` in the public GraphQL API.

- [#8734](https://github.com/graphql-hive/console/pull/8734)
  [`a6eaf2e`](https://github.com/graphql-hive/console/commit/a6eaf2e857ccb2a1d6f9293d3cd26b2d4e3bf79e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support uploading preprocessed app deployment
  documents. This omits the need of workers and does not make worker availability the bottleneck of
  the app deployment upload process.

- [#8736](https://github.com/graphql-hive/console/pull/8736)
  [`367c53b`](https://github.com/graphql-hive/console/commit/367c53b3ada4fb056e9a9bffe46f25435d07b57c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support routing server-side OAuth requests through
  the request broker so OAuth providers do not see the IP addresses of Hive cluster nodes. This
  applies to GitHub, Google, Okta, and organization OIDC token and user-information requests.

  Self-hosters who need to hide their cluster IP addresses must configure the `server` service with:

  - `REQUEST_BROKER=1`
  - `REQUEST_BROKER_ENDPOINT=<broker URL>`
  - `REQUEST_BROKER_SIGNATURE=<shared broker signature>`

- [#8679](https://github.com/graphql-hive/console/pull/8679)
  [`bd8f0f2`](https://github.com/graphql-hive/console/commit/bd8f0f211e5e5fdebe84ad2093b9f7087cc8a3a5)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Expose `SchemaChange.path` and
  `SchemaCheckConditionalBreakingChangeMetadata.settings` on the public GraphQL API, so the targets
  and schema coordinate behind a breaking change's usage can be read without parsing the change
  message.

### Patch Changes

- [#8708](https://github.com/graphql-hive/console/pull/8708)
  [`d3bfbf4`](https://github.com/graphql-hive/console/commit/d3bfbf41b43e9a0c4c9baacef7e766c771923e96)
  Thanks [@jdolle](https://github.com/jdolle)! - Upload persisted documents of an app deployment to
  the primary and mirror object storage concurrently instead of one after the other. Slow object
  storage writes made `hive app:create` uploads fail with `Unexpected error.` or time out in the
  CLI.

- [#8679](https://github.com/graphql-hive/console/pull/8679)
  [`bd8f0f2`](https://github.com/graphql-hive/console/commit/bd8f0f211e5e5fdebe84ad2093b9f7087cc8a3a5)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Check access before resolving
  `BreakingChangeMetadataTarget.target`; load a schema check's changes in `Target.schemaChecks` when
  only `hasSchemaChanges`, `hasUnapprovedBreakingChanges` or `cliApprovalMetadata` is selected;
  expose `breakingChangeFormula`, `requestCount` and the excluded app deployments on a check's
  conditional breaking change settings; and stop storing usage statistics for changes found safe by
  the nullability check.

- [#8717](https://github.com/graphql-hive/console/pull/8717)
  [`4512feb`](https://github.com/graphql-hive/console/commit/4512feb5ca9c5e068ce0309543b0371a85766566)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Upgrade `got` to v16 to fix ClickHouse
  requests failing with `write ECANCELED` (`Canceled because of SSL destruction`) instead of being
  retried.

  Since Node.js v24.20.0, a connection that closes while a request body is still being sent reports
  the error to `got` in a way that `got` v14 turned into an immediate failure, skipping the retry
  logic of the ClickHouse clients.

  `got` v16.1.0 also retries requests with a `FormData` body, which the ClickHouse client uses for
  audit log inserts and some operations queries.

- [#8714](https://github.com/graphql-hive/console/pull/8714)
  [`0a100e4`](https://github.com/graphql-hive/console/commit/0a100e4885bbf616f399eb99537e9f6a09d25f7d)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fix the schema check page
  freezing on checks with thousands of schema changes. Safe changes are now grouped by kind, and
  breaking changes and each group are paginated 50 at a time, so the 5 types a check added are no
  longer buried among thousands of description edits. A check's schemas are only loaded when a
  schema tab is opened, so the check itself loads without them.

- [#8726](https://github.com/graphql-hive/console/pull/8726)
  [`e085b8e`](https://github.com/graphql-hive/console/commit/e085b8e1ef7a9197d285b2f3b4264fb47bf1a963)
  Thanks [@jdolle](https://github.com/jdolle)! - Use one request id per API request. The id is the
  incoming `x-request-id` header, or a generated UUID when none was sent, and it is now the same
  value on the API's own log lines, the `request.id` trace attribute, the `x-request-id` response
  header, and the requests forwarded to the schema, policy and commerce services. Logs and traces of
  those services can therefore be correlated with the API request that triggered them even when no
  proxy supplied an id. Every response from a Hive service now carries that id in the `x-request-id`
  header, including error responses produced before a request handler runs. Background proposal
  compositions run by the workflows service now carry the id of the API request that scheduled them.
  The schema, policy, commerce and usage services log a warning when a request arrives without an
  `x-request-id` header: their callers (other Hive services, and the Hive client libraries reporting
  usage) always send one, so a missing id means a caller is not propagating it.

- [#8709](https://github.com/graphql-hive/console/pull/8709)
  [`28023c3`](https://github.com/graphql-hive/console/commit/28023c38c223b38dcc2dc038e73505b1833677d9)
  Thanks [@jdolle](https://github.com/jdolle)! - When a persisted-document upload of an app
  deployment is aborted by the client, times out on the server, or one of its storage writes fails,
  every remaining object storage and ClickHouse request of that batch is cancelled, including
  pending retries. Previously the worker kept uploading the whole batch after the request was
  already over.

- [#8730](https://github.com/graphql-hive/console/pull/8730)
  [`b3cb83a`](https://github.com/graphql-hive/console/commit/b3cb83ae9a0f3fdf072a64667761b68efedcce32)
  Thanks [@jdolle](https://github.com/jdolle)! - Trace persisted document ingestion inside the
  GraphQL API's worker threads. The worker's spans (schema build, document validation, the
  ClickHouse insert, every S3 object write with its status and retry count, and how long a batch
  waited for a worker) now join the request's trace, every log line a batch produces in the worker
  carries the request id, and spans still buffered when a worker exits or the API shuts down are
  flushed first.

- [#8714](https://github.com/graphql-hive/console/pull/8714)
  [`0a100e4`](https://github.com/graphql-hive/console/commit/0a100e4885bbf616f399eb99537e9f6a09d25f7d)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Paged `SchemaChangeConnection`
  results (a schema check's `breakingSchemaChanges`, `safeSchemaChanges`, `schemaChanges` and the
  `changes` of a safe-change group, on the check and on its contract checks) now report their
  position: `edges.cursor` encodes the change's offset, `hasNextPage` and `hasPreviousPage` say
  whether more follow or precede the page, `startCursor` is empty on the first page and `endCursor`
  empty on the last, and `total` and `totalCount` count the whole list rather than the page.

- [#8679](https://github.com/graphql-hive/console/pull/8679)
  [`bd8f0f2`](https://github.com/graphql-hive/console/commit/bd8f0f211e5e5fdebe84ad2093b9f7087cc8a3a5)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Listing `Target.schemaChecks`
  with only `hasSchemaChanges` or `hasUnapprovedBreakingChanges` selected no longer loads each
  check's change lists; both flags are computed in the database.

- [#8679](https://github.com/graphql-hive/console/pull/8679)
  [`bd8f0f2`](https://github.com/graphql-hive/console/commit/bd8f0f211e5e5fdebe84ad2093b9f7087cc8a3a5)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fix `Target.schemaChecks`
  returning no changes when they are selected through the `SchemaCheck` interface or through
  `schemaChanges`, which made the public API list every check without its changes.

- [#8696](https://github.com/graphql-hive/console/pull/8696)
  [`27b04ab`](https://github.com/graphql-hive/console/commit/27b04ab335aec5c0b54d2ff3ba38fd3428b492c1)
  Thanks [@Abhist17](https://github.com/Abhist17)! - Fix links in emails sent with
  `EMAIL_PROVIDER=sendmail` losing a dot (for example `…prod.proddsl.example…` arriving as
  `…prod.proddslexample…`). The body is now base64-encoded, so no line can start with a "." that the
  receiving server would strip.

  Closes [#7702](https://github.com/graphql-hive/platform/issues/7702)

- [#8712](https://github.com/graphql-hive/console/pull/8712)
  [`6c7ab24`](https://github.com/graphql-hive/console/commit/6c7ab246933674ce74fd0a208e366f1958306247)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fix the schema check and history
  pages freezing on the Public Schema and Supergraph diffs of large schemas. Both schemas are now
  sorted before they are compared, so definitions that only moved (for example when types move
  between subgraphs) no longer show as changes, and a diff too large to compute shows a notice
  instead of locking the page. The unchanged Public Schema view of a check now shows the public
  schema instead of the service SDL.

- [#8721](https://github.com/graphql-hive/console/pull/8721)
  [`52eb8f1`](https://github.com/graphql-hive/console/commit/52eb8f12f5da3c20a75e7daa4cf3134e63f865ae)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Stop calling breaking changes
  "safe based on usage data" when Hive doesn't record usage for what they change, such as a removed
  type, a removed union member or a new required argument. They now say that usage isn't tracked for
  them, and the version history summary counts them as not checked against usage instead of safe.
  Changes with nothing more to show no longer open to "No details available".

## 14.0.1

### Patch Changes

- [#8711](https://github.com/graphql-hive/console/pull/8711)
  [`b5839de`](https://github.com/graphql-hive/console/commit/b5839dec170ce82afc839cb5d81c55cf6f2a6606)
  Thanks [@jdolle](https://github.com/jdolle)! - Give the persisted-document worker 50 seconds
  instead of 20 to finish an `addDocumentsToAppDeployment` batch, so the server answers before the
  CLI's 55 second upload timeout instead of the CLI aborting a batch the server is still processing.

- [#8685](https://github.com/graphql-hive/console/pull/8685)
  [`a0241ef`](https://github.com/graphql-hive/console/commit/a0241effe46144d2777339a3a175f26c662474ce)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fix the `no-unreachable-types`
  schema policy rule reusing the reachable types of the first schema it linted, which reported
  reachable types as unreachable (and the reverse) for every later check until the policy service
  restarted.

## 14.0.0

### Major Changes

- [#8563](https://github.com/graphql-hive/console/pull/8563)
  [`a892ec8`](https://github.com/graphql-hive/console/commit/a892ec822056740958391d0dd4fc958c4b96486f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **BREAKING CHANGE** Require the migration service
  to be configured with `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`. These variables must
  connect to the same Redis instance used by the API so database migrations can acquire the schema
  registry lock before modifying registry state.

- [#8563](https://github.com/graphql-hive/console/pull/8563)
  [`a892ec8`](https://github.com/graphql-hive/console/commit/a892ec822056740958391d0dd4fc958c4b96486f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **BREAKING CHANGE**: Before upgrading to this
  version, you must first upgrade to `hive@13.1.0`. Do not upgrade directly from an earlier version
  while the system is serving traffic.

  To perform a rolling upgrade:

  1. Upgrade all running services to `hive@13.1.0`.
  2. Wait until all database migrations for `hive@13.1.0` have completed successfully and that
     version is serving traffic.
  3. Upgrade all services to this major version and wait for the database migration to complete.

  If downtime is acceptable, you can instead stop all traffic and running services, then upgrade
  directly to this version and run the migrations before bringing the system back online.

  ***

  Backfill latest contract versions from `contract_versions` to `schema_versions`.

- [#8593](https://github.com/graphql-hive/console/pull/8593)
  [`a8e7955`](https://github.com/graphql-hive/console/commit/a8e795598ad16586e35c58621a501f7897765c51)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **BREAKING CHANGE**: Contract schemas are now
  stored exclusively as schema versions. Hive no longer writes contract updates to the legacy
  contract tables.

## 13.1.0

### Minor Changes

- [#8678](https://github.com/graphql-hive/console/pull/8678)
  [`5124f15`](https://github.com/graphql-hive/console/commit/5124f154e100819f19fbe2c4b94540f8e04ac560)
  Thanks [@jdolle](https://github.com/jdolle)! - Report schema publish results to the Hive CLI when
  the GitHub integration is used.

  `GitHubSchemaPublishSuccess` now has an `isValid` field, so the CLI can fail a CI job when a
  `--github` publish is rejected.

- [#8683](https://github.com/graphql-hive/console/pull/8683)
  [`085d06d`](https://github.com/graphql-hive/console/commit/085d06df2c43a82adc676e63cf6c4fa0dd441d0c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use Node.js
  [v24.21.0](https://nodejs.org/en/blog/release/v24.21.0).

- [#8562](https://github.com/graphql-hive/console/pull/8562)
  [`d182abd`](https://github.com/graphql-hive/console/commit/d182abdf928f57905b7bfdd7e7e1a95e152ca938)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce temporary dual writes of contract
  versions to both the `contract_versions` and `schema_versions` table. This release is an
  intermediate rollout step required to bring the database and application into a consistent state
  before subsequent graph-related changes are deployed.

### Patch Changes

- [#8562](https://github.com/graphql-hive/console/pull/8562)
  [`d182abd`](https://github.com/graphql-hive/console/commit/d182abdf928f57905b7bfdd7e7e1a95e152ca938)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Promoting a schema version to a different target
  now composes the contracts of the target the version is promoted to, instead of copying the
  contract versions of the source target.

- [#8670](https://github.com/graphql-hive/console/pull/8670)
  [`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-7mx3-vvmw-hjmv](https://github.com/advisories/GHSA-7mx3-vvmw-hjmv).

- [#8542](https://github.com/graphql-hive/console/pull/8542)
  [`5e3ca16`](https://github.com/graphql-hive/console/commit/5e3ca169022b6561eb984aa642e3b22e53338421)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add a partial index on `schema_versions` records
  without a `graph_metadata`, so that listing the schema versions of a graph that was backfilled
  from a target does not scan every newer record of that target.

- [#8643](https://github.com/graphql-hive/console/pull/8643)
  [`4b8bd44`](https://github.com/graphql-hive/console/commit/4b8bd440b6fde60b77bccfd42987bdd627290258)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix the schema service composition scheduler
  leaving a terminated worker in the pool after a handled composition error. The next composition
  assigned to that worker was silently dropped and timed out after 60 seconds. Workers are now kept
  alive after handled errors, and any worker that exits is replaced immediately.

- [#8670](https://github.com/graphql-hive/console/pull/8670)
  [`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-qqmp-wf37-98f9](https://github.com/advisories/GHSA-qqmp-wf37-98f9).

## 13.0.0

### Major Changes

- [#8534](https://github.com/graphql-hive/console/pull/8534)
  [`2d5d278`](https://github.com/graphql-hive/console/commit/2d5d27887371d7617f3d659dc801339ac0724dbe)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **BREAKING CHANGE**: Before upgrading to this
  version, you must first upgrade to hive@12.1.0. Do not upgrade directly from an earlier version
  while the system is serving traffic.

  To perform a rolling upgrade:

  1. Upgrade all running services to `hive@12.1.0`.
  2. Wait until all database migrations for `hive@12.1.0` have completed successfully.
  3. Upgrade all services to this major version.

  If downtime is acceptable, you can instead stop all traffic and running services, then upgrade
  directly to this version and run the migrations before bringing the system back online.

  ***

  Backfill `graphs` table for existing `targets` and `contracts` to bring the database into a
  consistent state.

### Minor Changes

- [#8635](https://github.com/graphql-hive/console/pull/8635)
  [`a46d954`](https://github.com/graphql-hive/console/commit/a46d954c01e518645e0c6b1d73467b22c85efa53)
  Thanks [@Abhist17](https://github.com/Abhist17)! - Add the `CLICKHOUSE_DB` environment variable to
  choose which ClickHouse database Hive Console uses, so one ClickHouse server can host other
  databases alongside it. Every service sends it as the `database` request setting; the database
  must already exist. Unset, it is `default`, which is where Hive Console has always put its tables.

  Resolves https://github.com/graphql-hive/console/issues/8634

- [#8613](https://github.com/graphql-hive/console/pull/8613)
  [`6664b16`](https://github.com/graphql-hive/console/commit/6664b16386e2cbf48ca27435b6907fe9d9e4859a)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - The date range lives in the URL
  and stays inside the organization's usage retention: presets past it are greyed out, a link
  outside it resets with a toast, and the API rejects usage reads that start before it
  (`PERIOD_OUTSIDE_RETENTION`).

  Self-hosted instances: retention is now enforced. An instance that never configured it stores 7
  days per organization; set `CLICKHOUSE_TTL_TABLES` (for example `1 YEAR`) to raise it, as
  described under "Data Retention" in the
  [self-hosting guide](https://the-guild.dev/graphql/hive/docs/schema-registry/self-hosting/get-started).

  Metric alert rules: a `% change vs. previous` rule reads twice its window, so the form greys out
  windows past half the organization's retention and the API rejects them. A 3d window preset is
  added.

### Patch Changes

- [#8623](https://github.com/graphql-hive/console/pull/8623)
  [`2cd4297`](https://github.com/graphql-hive/console/commit/2cd429775d237f9272838d7e9aec9d38e05a9cff)
  Thanks [@Abhist17](https://github.com/Abhist17)! - Pass `REDIS_USERNAME` to the Redis client when
  authenticating with a password. It was parsed and documented for Redis ACL authentication, but
  only reached the client when AWS IAM auth was enabled, so ACL users could not connect.

  Resolves https://github.com/graphql-hive/console/issues/8140

- [#8644](https://github.com/graphql-hive/console/pull/8644)
  [`febd8a3`](https://github.com/graphql-hive/console/commit/febd8a309d2d687e0568217738803d7c9ab7e84e)
  Thanks [@jdolle](https://github.com/jdolle)! - Schema service: add 20 second and 45 second buckets
  to the composition duration histograms, and make `COMPOSITION_WORKER_COUNT` configurable from the
  environment. It was declared as a number, so any value set in the environment (always a string)
  failed validation on startup.

- [#8619](https://github.com/graphql-hive/console/pull/8619)
  [`8d4903c`](https://github.com/graphql-hive/console/commit/8d4903c9eff5b3e50964d3650ddaab7d0b12ab60)
  Thanks [@jdolle](https://github.com/jdolle)! - Restore the documented 60 second budget for
  external schema composition. `SCHEMA_COMPOSITION_TIMEOUT_MS` now defaults to 60 seconds, and
  `SCHEMA_EXTERNAL_COMPOSITION_TIMEOUT_MS` defaults to 5 seconds less than it. The external timeout
  is now one budget for the whole external composition call, shared by retries and contract
  compositions, instead of a per-attempt limit: a fast failure (connection refused, reset, 5xx) is
  retried with the time that is left, a slow service gets the whole budget on its first attempt, and
  a spent budget is not retried. The GraphQL API and the workflows service no longer cap schema
  service requests at 30 seconds, which silently limited any schema service setting; the cap is now
  60 seconds.

- [#8632](https://github.com/graphql-hive/console/pull/8632)
  [`b1d5dd2`](https://github.com/graphql-hive/console/commit/b1d5dd2aa1281dc8e9676dd978376f93b6266094)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-xjh9-v7x6-24jw](https://github.com/advisories/GHSA-xjh9-v7x6-24jw).

- [#8665](https://github.com/graphql-hive/console/pull/8665)
  [`a83ee0d`](https://github.com/graphql-hive/console/commit/a83ee0d96871698690c107c95e362020eaa7f1cf)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Retry the GitHub check-run update
  for a few seconds when GitHub answers 404 right after creating the check-run, so a schema check or
  publish no longer fails on GitHub's read-after-write lag.

- [#8666](https://github.com/graphql-hive/console/pull/8666)
  [`d50f988`](https://github.com/graphql-hive/console/commit/d50f9888634af9cc45e796971c2ce687c8e1b80b)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix OIDC sign-in intermittently failing with
  "Please try again.". The server-generated OAuth state was base64url-encoded and could contain
  `--`, the delimiter used to separate the state from the OIDC integration id, so about 1% of OIDC
  logins could not find their pending sign-in state.

- [#8622](https://github.com/graphql-hive/console/pull/8622)
  [`423ac7f`](https://github.com/graphql-hive/console/commit/423ac7fb85b4fdac99b9c6e99d3441a8def3936d)
  Thanks [@Abhist17](https://github.com/Abhist17)! - Show the context ID of a schema check on the
  check details page. Approvals of breaking changes are tied to that ID, but it was only visible
  inside the approval dialog of a failed check.

- [#8614](https://github.com/graphql-hive/console/pull/8614)
  [`08eb209`](https://github.com/graphql-hive/console/commit/08eb209d245626b136b97a2b3ca6a619d3796c18)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Set and expire the redis key for a sign in attempt
  state in the same statement

## 12.1.0

### Minor Changes

- [#8518](https://github.com/graphql-hive/console/pull/8518)
  [`f5d702b`](https://github.com/graphql-hive/console/commit/f5d702ba61dfa272af67d5057e2067378d837c70)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce internal entities for graphs. This
  release is an intermediate rollout step required to bring the database and application into a
  consistent state before subsequent graph-related changes are deployed.

### Patch Changes

- [#8607](https://github.com/graphql-hive/console/pull/8607)
  [`b936b9a`](https://github.com/graphql-hive/console/commit/b936b9a23f7193fcfb17f85bb38f7cf26f148819)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-4mh8-r7rc-xpvc](https://github.com/advisories/GHSA-4mh8-r7rc-xpvc).

- [#8609](https://github.com/graphql-hive/console/pull/8609)
  [`7e443af`](https://github.com/graphql-hive/console/commit/7e443af54d09bf4ed4297436c10de9bfae492468)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fixes a long-standing client
  crash (graphcache) after modifying a Metric Alert

- [#8607](https://github.com/graphql-hive/console/pull/8607)
  [`b936b9a`](https://github.com/graphql-hive/console/commit/b936b9a23f7193fcfb17f85bb38f7cf26f148819)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilities
  [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx),
  [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g),
  [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8),
  [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32),
  [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh),
  [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2),
  [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v),
  [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3),
  [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r),
  [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8),
  [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj) and
  [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f).

- [#8607](https://github.com/graphql-hive/console/pull/8607)
  [`b936b9a`](https://github.com/graphql-hive/console/commit/b936b9a23f7193fcfb17f85bb38f7cf26f148819)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4).

- [#8607](https://github.com/graphql-hive/console/pull/8607)
  [`b936b9a`](https://github.com/graphql-hive/console/commit/b936b9a23f7193fcfb17f85bb38f7cf26f148819)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p).

## 12.0.0

### Major Changes

- [#8603](https://github.com/graphql-hive/console/pull/8603)
  [`79631e2`](https://github.com/graphql-hive/console/commit/79631e2326443960cd2ff9824fbe521e482a530b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Replace `Mutation.disableContract` mutation with
  `Mutation.deleteContract`, which permanently deletes contracts instead of soft-deleting them.
  Historical contract versions are retained and remain available from their schema versions.

  Remove `Contract.isDisabled` and `Target.activeContracts`. Use `Target.contracts` as the single
  source of truth for existing contracts; legacy disabled contracts are excluded from this
  connection.

- [#8601](https://github.com/graphql-hive/console/pull/8601)
  [`762334e`](https://github.com/graphql-hive/console/commit/762334ed80bfa94ccbdf6ee07a9fe6f6ec9583f9)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Creating a contract now requires alphanumeric
  names.

### Patch Changes

- [#8597](https://github.com/graphql-hive/console/pull/8597)
  [`b94f2d2`](https://github.com/graphql-hive/console/commit/b94f2d2a6407b72ded8615a2acd29b7059bdf336)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix the trace list and trace filter options
  occasionally omitting recently ingested traces of a target after a filtered request. ClickHouse's
  query condition cache keyed the verdicts of these queries by their PREWHERE only while a separate
  WHERE dropped granules through skip indexes; the queries now carry every condition in a single
  PREWHERE.

## 11.16.1

### Patch Changes

- [#8590](https://github.com/graphql-hive/console/pull/8590)
  [`914d28d`](https://github.com/graphql-hive/console/commit/914d28d48a2cca5a7050f7595e9ecbea657a9cdb)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-jvvf-x445-j334](https://github.com/advisories/GHSA-jvvf-x445-j334) and
  [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj).

- [#8491](https://github.com/graphql-hive/console/pull/8491)
  [`94032da`](https://github.com/graphql-hive/console/commit/94032dad6e9eb8bf88e39b366c2f6929e7df17b1)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix subscription operations' client version parsing
  so they can populate app deployment "last used" tracking. Subscription operations were splitting
  `persistedDocumentHash` on `/` instead of `~` (the actual `appName~appVersion~hash` format used
  everywhere else).

- [#8590](https://github.com/graphql-hive/console/pull/8590)
  [`914d28d`](https://github.com/graphql-hive/console/commit/914d28d48a2cca5a7050f7595e9ecbea657a9cdb)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-253c-mchw-3w2r](https://github.com/advisories/GHSA-253c-mchw-3w2r).

## 11.16.0

### Minor Changes

- [#8556](https://github.com/graphql-hive/console/pull/8556)
  [`0961843`](https://github.com/graphql-hive/console/commit/0961843fdac3b2f9ae0e25d05bc48d25d2c63d4d)
  Thanks [@jdolle](https://github.com/jdolle)! - Report schema check results to the Hive CLI when
  the GitHub integration is used.

  - `GitHubSchemaCheckSuccess` now has a `valid` field and the stored `schemaCheck`, so the CLI can
    fail a CI job when a schema check fails, and approve it with `--forceSafe`.
  - When the GitHub check-run can not be updated after a schema check ran, the error now says that
    the check ran, instead of saying that the check-run could not be created.

- [#8558](https://github.com/graphql-hive/console/pull/8558)
  [`cc0119f`](https://github.com/graphql-hive/console/commit/cc0119f0396aa483060d1395c964f7d78f41bcc5)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix how schema push and publishing a revision
  handle repeated pushes, service names, concurrent pushes and expired revisions.

  - Pushing a revision that already exists with the same schema succeeds and extends the revision's
    expiry, so an unpublished revision stays available for 30 days after its most recent push. A
    revision that has been published never expires.
  - Concurrent pushes of the same revision no longer fail with an unexpected error.
  - A publish whose revision expires and is removed while it is being published now reports that the
    revision was not found, instead of an unexpected error.
  - Schema push now rejects invalid service names instead of accepting them and failing when the
    revision is published. Unlike schema check and publish, this also applies to existing services
    whose names are no longer valid, so that services can be migrated to the new name format.
  - Schema push now ignores the service name for single-schema projects, like schema publish does.
  - Publishing a schema revision without a service name in a Federation or schema stitching project
    now reports the missing service name, instead of reporting that the revision was not found.

- [#8577](https://github.com/graphql-hive/console/pull/8577)
  [`a9c60cf`](https://github.com/graphql-hive/console/commit/a9c60cf614993f3f9e9a0adf38e8dac0b38c02cf)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use redis based rate limiting for email
  verification and organization invite sending instead of in-memory based rate limiting.

### Patch Changes

- [#8573](https://github.com/graphql-hive/console/pull/8573)
  [`89f83ab`](https://github.com/graphql-hive/console/commit/89f83abd9b61a0cc83e992f4ec5623b74d8f8d1d)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix the Docker `HEALTHCHECK` of the service images.
  The probe command was never baked into the image, so every service reported healthy right after
  starting. Containers now become healthy only once their `/_readiness` endpoint responds, which
  makes `depends_on: service_healthy` and `docker compose up --wait` wait for the services to
  actually be ready. The `org.opencontainers.image.title`, `version` and `description` labels are
  now populated as well.

- [#8578](https://github.com/graphql-hive/console/pull/8578)
  [`e2caad6`](https://github.com/graphql-hive/console/commit/e2caad6a07fcf6238929b9c9767cc4b31fc650ad)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-6vj9-mwq6-2f5v](https://github.com/advisories/GHSA-6vj9-mwq6-2f5v).

- [#8565](https://github.com/graphql-hive/console/pull/8565)
  [`e30136b`](https://github.com/graphql-hive/console/commit/e30136baac429d2d77992e693b5a02eab5147977)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Preserve all executable definitions when
  normalizing operation documents for usage reporting.

- [#8544](https://github.com/graphql-hive/console/pull/8544)
  [`e9d2ff8`](https://github.com/graphql-hive/console/commit/e9d2ff83a511ac32a8955edae8722595bda05103)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Allow schema versions without an action ID and
  exclude those records from the action ID index.

## 11.15.0

### Minor Changes

- [#8512](https://github.com/graphql-hive/console/pull/8512)
  [`ab9c3bd`](https://github.com/graphql-hive/console/commit/ab9c3bdbec300703f398f553f989d8472c3be53b)
  Thanks [@Abhist17](https://github.com/Abhist17)! - Add configurable superadmin access for
  self-hosted deployments.

  Set `SUPERADMIN_FOREIGN_ORGANIZATION_ACTIONS` to a comma-separated list of actions granted in
  organizations where a superadmin is not a member (defaults to `*:describe`).

  Set `SUPERADMIN_ORGANIZATION_ID` to an organization UUID to treat its active SCIM-provisioned
  users as superadmins.

- [#8547](https://github.com/graphql-hive/console/pull/8547)
  [`b0d4e55`](https://github.com/graphql-hive/console/commit/b0d4e557a438059e06bca83406ab4855f5905710)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Replace MinIO with versitygw in the docker compose
  files, since MinIO's docker images are no longer published. The S3 data volume moves from
  `.hive/minio` to `.hive/versitygw`; existing objects are not migrated.

  The S3 credentials the community compose file reads from your `.env` are renamed:

  1. Rename `MINIO_ROOT_USER` to `S3_ROOT_USER`
  2. Rename `MINIO_ROOT_PASSWORD` to `S3_ROOT_PASSWORD`

  The old names are no longer read, so the S3 service and the server would otherwise start with
  empty credentials.

### Patch Changes

- [#8536](https://github.com/graphql-hive/console/pull/8536)
  [`c9328ea`](https://github.com/graphql-hive/console/commit/c9328ea8d833b074c0bb607dc67d2d2fd35d7a50)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Upgrades composition library to
  `v0.27.0` - adds satisfiability checking for `@fromContext` arguments

- [#8540](https://github.com/graphql-hive/console/pull/8540)
  [`7f86749`](https://github.com/graphql-hive/console/commit/7f867499c4cf8d9e2efbd51138543581e7813f2a)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix usage-ingestor async inserts being written to
  ClickHouse one Kafka message at a time instead of batched. ClickHouse enables an adaptive
  async-insert busy timeout by default; it starts at 50ms and only grows when inserts arrive within
  50ms of each other, so at the ingestor's insert rate the configured
  `CLICKHOUSE_ASYNC_INSERT_BUSY_TIMEOUT_MS` was never reached and every INSERT was flushed on its
  own, creating one part per Kafka message per replica in `operations` and in every rollup fed from
  it. The adaptive timeout is now disabled so the configured busy timeout is a fixed flush interval.
  Expect roughly one part per busy timeout per replica per rollup instead of one per message; usage
  data is buffered in ClickHouse memory for up to that timeout before it is written.

- [#8492](https://github.com/graphql-hive/console/pull/8492)
  [`466b08e`](https://github.com/graphql-hive/console/commit/466b08edb92540ad5f69f3c911c5b96a308bf0e2)
  Thanks [@jdolle](https://github.com/jdolle)! - Add a metric and a logged payload when the usage
  ingestor hits a corrupt/unparseable usage report. Previously, the message retried silently forever
  with no way for an operator to notice a stuck partition.

- [#8539](https://github.com/graphql-hive/console/pull/8539)
  [`edaee3a`](https://github.com/graphql-hive/console/commit/edaee3a4e947354f96c0dda256bf0cebc65239fc)
  Thanks [@jdolle](https://github.com/jdolle)! - Clarify the wording of the target picker in the
  Conditional Breaking Changes settings. The section now explains that checked targets are the
  source of usage data the threshold is measured against, and includes examples such as checking
  only the production target on a development target.

- [#8448](https://github.com/graphql-hive/console/pull/8448)
  [`559f1e3`](https://github.com/graphql-hive/console/commit/559f1e320207fba57a401110bc69c2c01a4c1791)
  Thanks [@jdolle](https://github.com/jdolle)! - Replace the `ZENDESK_SUBDOMAIN` environment
  variable with `ZENDESK_BASE_URL`. When `ZENDESK_SUPPORT=1`, set
  `ZENDESK_BASE_URL=https://<subdomain>.zendesk.com` (a trailing slash is ignored). This allows
  pointing the support integration at a non-Zendesk host, such as a local mock server.

## 11.14.2

### Patch Changes

- [#8533](https://github.com/graphql-hive/console/pull/8533)
  [`a46b133`](https://github.com/graphql-hive/console/commit/a46b133029dd6e7ced9a04fb1b62966702a25ff8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-8wmf-6v46-5gfg](https://github.com/advisories/GHSA-8wmf-6v46-5gfg).

- [#8531](https://github.com/graphql-hive/console/pull/8531)
  [`edb1b9b`](https://github.com/graphql-hive/console/commit/edb1b9bcdc0991b3430653972b3ad6f0f05756bc)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Return a 404 for missing frontend
  assets instead of the SPA HTML fallback.

- [#8325](https://github.com/graphql-hive/console/pull/8325)
  [`21e64b1`](https://github.com/graphql-hive/console/commit/21e64b1a743822a65728267e915ee8954a04b2ac)
  Thanks [@lisa-0831](https://github.com/lisa-0831)! - Attach standalone Cloudflare Worker and AWS
  Lambda CDN archives to stable releases and document their deployment configuration.

## 11.14.1

### Patch Changes

- [#8530](https://github.com/graphql-hive/console/pull/8530)
  [`d427046`](https://github.com/graphql-hive/console/commit/d427046ca6f7a2d4ad5b3dee3c8bb4678b4da35f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update
  `@theguild/federation-composition` to `0.26.3`. Unresolvable `@requires`, `@key`, `@provides` and
  `@fromContext` selections are now reported as composition errors instead of throwing, so
  composition fails with a proper error message instead of crashing.

- [#8493](https://github.com/graphql-hive/console/pull/8493)
  [`1de91b9`](https://github.com/graphql-hive/console/commit/1de91b96205be07b15c258efd204220e31c66cbf)
  Thanks [@jdolle](https://github.com/jdolle)! - Track operations dropped by the usage fallback
  queue. Messages were silently discarded when they were too large for Kafka or when the queue
  overflowed its max size, with only a log line and no metric - add dedicated counters for each case
  so both failure modes are visible to monitoring.

## 11.14.0

### Minor Changes

- [#8498](https://github.com/graphql-hive/console/pull/8498)
  [`995a5de`](https://github.com/graphql-hive/console/commit/995a5de801ad60071102114f457c1894730b88cd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `schema:publish --fail-on-composition-error` to
  prevent publishing a federation schema that would cause a composition error.

  Closes https://github.com/graphql-hive/console/issues/7588

- [#8461](https://github.com/graphql-hive/console/pull/8461)
  [`9422d5a`](https://github.com/graphql-hive/console/commit/9422d5a0bed09a86ca23c6b9bd2c148d6c11d4e0)
  Thanks [@jdolle](https://github.com/jdolle)! - Add SchemaVersion.origin to public schema. This
  provides necessary info to determine which subgraph was added or removed, or whether a target was
  promoted to create the schema version.

- [#8490](https://github.com/graphql-hive/console/pull/8490)
  [`dbc26a5`](https://github.com/graphql-hive/console/commit/dbc26a5f88369ca83a54d1d0e50e7acac53a95dd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add schema push support. Named schema revisions can
  now be uploaded without publishing them immediately and published later.

  Adds the `schema:push` permission for organization members, organization access tokens, and target
  access tokens for felxibly managing access control for the new capabality.

  Use the `hive schema:push` command for pushing a (subgraph) schema to the registry, then reference
  it when running the `hive schema:publish` command.

  ```sh
  hive schema:push schema.graphql \
    --target my-org/my-project/my-target \
    --revision "$REVISION"
  
  hive schema:publish \
    --target my-org/my-project/my-target \
    --revision "$REVISION"
  ```

  Closes https://github.com/graphql-hive/console/issues/8404

## 11.13.0

### Minor Changes

- [#8426](https://github.com/graphql-hive/console/pull/8426)
  [`48d3000`](https://github.com/graphql-hive/console/commit/48d3000c32cc74d950159c3551332ba9725f3cba)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric alert rules are now
  available to every organization. Create rules on a target's Alerts page to be notified when
  latency, error rate, or traffic crosses a fixed threshold or changes by a set percentage.

### Patch Changes

- [#8454](https://github.com/graphql-hive/console/pull/8454)
  [`e6773b5`](https://github.com/graphql-hive/console/commit/e6773b57ad576583da68d6c480144e0f807c7530)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-2v4p-qf9q-27wj](https://github.com/advisories/GHSA-2v4p-qf9q-27wj).

- [#8403](https://github.com/graphql-hive/console/pull/8403)
  [`31183ae`](https://github.com/graphql-hive/console/commit/31183ae05160829214ad9f6f82cae2b7e3be2fc7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add a subgraph filter to the schema explorer and
  move the explorer's filters into a single filter menu.

  The explorer can now be narrowed to one or more subgraphs, on the main view as well as the type,
  unused and deprecated views. Selecting a type, searching for a field, filtering by metadata and
  toggling descriptions now live in the same filter menu, with active filters shown as chips. The
  All / Unused / Deprecated tabs moved next to the page title.

- [#8464](https://github.com/graphql-hive/console/pull/8464)
  [`0d5b665`](https://github.com/graphql-hive/console/commit/0d5b6659c6bb2cd3ed92d6dbeb86f635ccc1dc7f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix federation contract composition attaching
  `@inaccessible` to `ContextFieldValue`.

- [#8460](https://github.com/graphql-hive/console/pull/8460)
  [`bba8d96`](https://github.com/graphql-hive/console/commit/bba8d9675e7d7a82276df95b2b35ed95d2654ab3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Preserve types referenced by directive arguments in
  schema contracts and prevent `federation__ContextFieldValue` from leaking into composed
  supergraphs.

- [#8459](https://github.com/graphql-hive/console/pull/8459)
  [`bbb0644`](https://github.com/graphql-hive/console/commit/bbb06443b7041ba992ee6483a4d029d0f9ddb5ff)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - address vulnerabilities
  [GHSA-2x7j-588g-ccc2](https://github.com/advisories/GHSA-2x7j-588g-ccc2),
  [GHSA-wmmp-3585-3rmp](https://github.com/advisories/GHSA-wmmp-3585-3rmp),
  [GHSA-cc9r-2j5m-2m83](https://github.com/advisories/GHSA-cc9r-2j5m-2m83), and
  [GHSA-8m3c-c648-2xjj](https://github.com/advisories/GHSA-8m3c-c648-2xjj).

## 11.12.2

### Patch Changes

- [#8425](https://github.com/graphql-hive/console/pull/8425)
  [`49c36fe`](https://github.com/graphql-hive/console/commit/49c36fe2adc8e4590d4029b6860a9ff1113704bf)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

- [#8438](https://github.com/graphql-hive/console/pull/8438)
  [`7addc47`](https://github.com/graphql-hive/console/commit/7addc47db196350cdce9459dbe2c42880c653152)
  Thanks [@jdolle](https://github.com/jdolle)! - Remove content-type header from sso discovery doc
  request. Since no payload is sent with this request, the header can cause the request to fail.
  This header is specifically not required by the configuration request

- [#8430](https://github.com/graphql-hive/console/pull/8430)
  [`ab61aa7`](https://github.com/graphql-hive/console/commit/ab61aa74d9430524f06d1217258e97183781dedd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-vp52-pcj8-j9qc](https://github.com/advisories/GHSA-vp52-pcj8-j9qc).

- [#8443](https://github.com/graphql-hive/console/pull/8443)
  [`c0654ee`](https://github.com/graphql-hive/console/commit/c0654ee7e597ed4997ca5574f7bb06642243f1fc)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix schema promotion raising an unexpected server
  error for legacy schema version logs.

- [#8442](https://github.com/graphql-hive/console/pull/8442)
  [`e7ca358`](https://github.com/graphql-hive/console/commit/e7ca358d10b3ac8e3bd376622004a51cf412e68d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilities
  [GHSA-3m5p-2c4r-xxw2](https://github.com/advisories/GHSA-3m5p-2c4r-xxw2),
  [GHSA-w2qp-rph6-63g4](https://github.com/advisories/GHSA-w2qp-rph6-63g4),
  [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp),
  [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc),
  [GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8), and
  [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf).

## 11.12.1

### Patch Changes

- [#8421](https://github.com/graphql-hive/console/pull/8421)
  [`c970ddb`](https://github.com/graphql-hive/console/commit/c970ddbda4b73557830de2e955c96003418232dd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Updates
  `@theguild/federation-composition` to `v0.26.0`. Adds support for `@context` and `@fromContext`
  directives in Federation.

- [#8413](https://github.com/graphql-hive/console/pull/8413)
  [`0b75e08`](https://github.com/graphql-hive/console/commit/0b75e08958d0d39db510a0aea89c9a4ccb9ba50f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-w67g-5rqw-f597](https://github.com/advisories/GHSA-w67g-5rqw-f597).

- [#8409](https://github.com/graphql-hive/console/pull/8409)
  [`7448692`](https://github.com/graphql-hive/console/commit/74486928a27b73f2ca8de0536d360f9b6bc72348)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Improve usage-service performance:

  - compression is now done with zstd instead of gzip
  - report processing is more efficient now, we cache things cross-requests and significantly
    reduced CPU usage (4x more throughput)

- [#8379](https://github.com/graphql-hive/console/pull/8379)
  [`a6089c5`](https://github.com/graphql-hive/console/commit/a6089c5e869b1b83edda16d6452432428db3424d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Send correct status code 400 when alias limit,
  maximum directive count, max depth limit or token limit is exceeded for incoming operation.

- [#8398](https://github.com/graphql-hive/console/pull/8398)
  [`97071e9`](https://github.com/graphql-hive/console/commit/97071e9b1416f100652cabb95e5e4f4f596f38a3)
  Thanks [@jdolle](https://github.com/jdolle)! - Add a worker environment option to transform
  external composed supergraph to public sdl instead of reading the public SDL from the external
  composer.

## 11.12.0

### Minor Changes

- [#8327](https://github.com/graphql-hive/console/pull/8327)
  [`6c67f5f`](https://github.com/graphql-hive/console/commit/6c67f5f0751a223bbf4ef05b789d90973cb28075)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support providing a base schema when performaning a
  schema check.

- [#8373](https://github.com/graphql-hive/console/pull/8373)
  [`2d39e87`](https://github.com/graphql-hive/console/commit/2d39e87bdb67fdc0a4ad703f2a131d4c6026f0ea)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Allow colon characters (`:`) as part of the
  persisted documents hash. This allows uploading a persisted document manifest that contains a hash
  prefixed with the algorithm, e.g. `sha1:c9a2a17494906eeb5fff2c81a1980ae1c0b6650f`.

### Patch Changes

- [#8376](https://github.com/graphql-hive/console/pull/8376)
  [`b08a92c`](https://github.com/graphql-hive/console/commit/b08a92c7e9df356c329ca6f5b96b3be41abc8646)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix internal server error when promoting a monolith
  schema to an empty target.

- [#8377](https://github.com/graphql-hive/console/pull/8377)
  [`d2a20f7`](https://github.com/graphql-hive/console/commit/d2a20f7d64f118d9fd18241c656ddfc1bc52d4c1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Bump `otel-collector` docker image otel collector
  version from `3.14.10` to `3.22`.

- [#8369](https://github.com/graphql-hive/console/pull/8369)
  [`dc32e0b`](https://github.com/graphql-hive/console/commit/dc32e0b43081f87cf6f41a820e5e6e76cd4aa687)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-yoga package to patch vulnerability

## 11.11.1

### Patch Changes

- [#8361](https://github.com/graphql-hive/console/pull/8361)
  [`80172a5`](https://github.com/graphql-hive/console/commit/80172a5d24eaec8c072496e138ca1867f45a5875)
  Thanks [@jdolle](https://github.com/jdolle)! - Remove pretty print from check diff view. Add
  integration and e2e tests to verify publishing then checking the same SDL won't cause a difference
  in the schema check diff viewer

- [#8363](https://github.com/graphql-hive/console/pull/8363)
  [`1f7c817`](https://github.com/graphql-hive/console/commit/1f7c8177bd945b614ec18bee909b88c374b1f2ed)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7).

- [#8367](https://github.com/graphql-hive/console/pull/8367)
  [`890f026`](https://github.com/graphql-hive/console/commit/890f026aadc06a5a863f697e215e05bab1113f19)
  Thanks [@jdolle](https://github.com/jdolle)! - Add schema check composed SDL fields to public API

  ```graphql
  query CheckComposedSchemas($targetRef: TargetReferenceInput!, $checkId: ID!) {
    target(reference: $targetRef) {
      schemaCheck(id: $checkId) {
        compositeSchemaSDL # newly added
        supergraphSDL # newly added
      }
    }
  }
  ```

## 11.11.0

### Minor Changes

- [#8319](https://github.com/graphql-hive/console/pull/8319)
  [`84b28ff`](https://github.com/graphql-hive/console/commit/84b28fff9b9da65e6c423160cf3771850fad621a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve supergraph artifact formatting by reducing
  excessive whitespace for federation type definitions

### Patch Changes

- [#8350](https://github.com/graphql-hive/console/pull/8350)
  [`e0f5255`](https://github.com/graphql-hive/console/commit/e0f5255a013fcb388fb3a783688310a421ec8705)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj).

- [#8321](https://github.com/graphql-hive/console/pull/8321)
  [`6da8b84`](https://github.com/graphql-hive/console/commit/6da8b84dc868ae64b464021191b04e0d1a9af258)
  Thanks [@jdolle](https://github.com/jdolle)! - Hide resolutions from insights ui for input types

- [#8347](https://github.com/graphql-hive/console/pull/8347)
  [`6fbdf7f`](https://github.com/graphql-hive/console/commit/6fbdf7f692d7ab93cea0bfd499f5fca9a6c0b5e9)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)

- [#8328](https://github.com/graphql-hive/console/pull/8328)
  [`1ca35f6`](https://github.com/graphql-hive/console/commit/1ca35f6baa5f57f44f4382d924425ad897a1f634)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix link to composition compatibility report

## 11.10.0

### Minor Changes

- [#8184](https://github.com/graphql-hive/console/pull/8184)
  [`4540184`](https://github.com/graphql-hive/console/commit/4540184353ce927d41296f75113a7bce334b28bb)
  Thanks [@ben-m-klein](https://github.com/ben-m-klein)! - Add Discord as a first-class alert
  channel with Discord webhook formatting for alert notifications.

### Patch Changes

- [#8301](https://github.com/graphql-hive/console/pull/8301)
  [`df4ba0c`](https://github.com/graphql-hive/console/commit/df4ba0c2896b3d6683493dd4e225f6b5dae4e195)
  Thanks [@overpod](https://github.com/overpod)! - Add `EMAIL_PROVIDER_SMTP_IGNORE_TLS` environment
  variable for the `smtp` email provider.

  Set it to `1` to never use STARTTLS, even when the SMTP server advertises support for it. This
  allows sending emails through servers without working TLS support. The variable is opt-in and
  defaults to `0`, so existing deployments keep their current behaviour.

- [#8296](https://github.com/graphql-hive/console/pull/8296)
  [`e239df7`](https://github.com/graphql-hive/console/commit/e239df71d4981f4a4acda865dd19a79eaf91bbe4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - cleanup old unused database tables

- [#8305](https://github.com/graphql-hive/console/pull/8305)
  [`dee12d9`](https://github.com/graphql-hive/console/commit/dee12d9aa030ac3da5d6c87ea8d85bfc7276c3ab)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Add `ENCRYPTION_SECRET`
  environment variable to the `workflows` service.

  The service needs it to decrypt the Slack token stored by the API service when it dispatches
  metric-alert notifications. Set it to the same value as `ENCRYPTION_SECRET` on the server and
  schema services, otherwise the token cannot be decrypted and Slack notifications fail.

  The variable is optional, so existing deployments keep booting after an upgrade. When it is not
  set the service starts normally and every other task keeps running, but Slack metric-alert
  notifications are skipped.

## 11.9.0

### Minor Changes

- [#8062](https://github.com/graphql-hive/console/pull/8062)
  [`8270cac`](https://github.com/graphql-hive/console/commit/8270cac6516b20454914ee39d189e8c943487834)
  Thanks [@jdolle](https://github.com/jdolle)! - Add a new experimental config option that allows
  sending additional metrics (errors and resolution counts) to Hive Console.

### Patch Changes

- [#8291](https://github.com/graphql-hive/console/pull/8291)
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update to Node.js `24.18.1`.

## 11.8.0

### Minor Changes

- [#8084](https://github.com/graphql-hive/console/pull/8084)
  [`43d7cb3`](https://github.com/graphql-hive/console/commit/43d7cb3555d80e0e2fcbf6a9cae030fd015afcf8)
  Thanks [@mish-elle](https://github.com/mish-elle)! - Add opt-in AWS RDS IAM authentication for
  PostgreSQL connections. When enabled, services authenticate to RDS/Aurora using short-lived IAM
  tokens (SigV4) instead of static passwords.

  ### New environment variables

  | Variable                        | Services                                               | Description                                                            |
  | ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
  | `AWS_REGION`                    | server, commerce, tokens, usage, workflows, migrations | Default AWS region for the service for all AWS connections.            |
  | `POSTGRES_AWS_IAM_AUTH_ENABLED` | server, commerce, tokens, usage, workflows, migrations | Set to `1` to enable RDS IAM authentication.                           |
  | `POSTGRES_AWS_REGION`           | server, commerce, tokens, usage, workflows, migrations | AWS region of the RDS instance. Falls back to `AWS_REGION` if not set. |

  ### To enable

  - `POSTGRES_SSL=1` must be set (RDS IAM requires TLS).
  - `POSTGRES_AWS_REGION` or `AWS_REGION` must be set.
  - The pod/instance must have AWS credentials available (e.g. IRSA, EKS Pod Identity, instance
    profile) with `rds-db:connect` permission for the configured `POSTGRES_USER`.

- [#8272](https://github.com/graphql-hive/console/pull/8272)
  [`b695a80`](https://github.com/graphql-hive/console/commit/b695a80235c3abfa219ca0578acad33e3f567f09)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Remove the `tokens` service. Adjust the `server`
  and `usage` services to resolve the legacy target access tokens directly from redis and postgres.

  In order to update to this version remove the `tokens` entry within your docker compose file.

  ```diff
  -     tokens:
  -       image: '${DOCKER_REGISTRY}tokens${DOCKER_TAG}'
  -       # ...
  ```

  Then, make sure the `usage` service depends on the `db` container to be healthy.

  ```diff
       usage:
         # ...
         depends_on:
  -        tokens:
  +        db:
             condition: service_healthy
  ```

### Patch Changes

- [#8287](https://github.com/graphql-hive/console/pull/8287)
  [`a0092fc`](https://github.com/graphql-hive/console/commit/a0092fc7a9e25f70a7a4d9883a84765f7ebc88ea)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric alert notifications now
  link back to the alert rule in Hive Console. Slack and Microsoft Teams messages gain a "View alert
  in Hive" link, and the webhook payload gains a `url` field pointing at the same page.

  Self-hosted deployments need to set `WEB_APP_URL` on the workflows service to enable it:

  ```env
  WEB_APP_URL=https://your-hive-console-url
  ```

  The variable is optional. When it is unset, notifications are sent exactly as before, without the
  link, and the webhook payload's `url` is `null`.

## 11.7.2

### Patch Changes

- [#8166](https://github.com/graphql-hive/console/pull/8166)
  [`b1f17e2`](https://github.com/graphql-hive/console/commit/b1f17e2321e7e777d7e9fa2942460433a03f20b9)
  Thanks [@AreebEhsan](https://github.com/AreebEhsan)! - Include contract changes in the GitHub CI
  schema-check summary. Previously, a `schema:check --github` run on a composite/federation project
  that changed only a contract (while the core composed schema was unchanged) was reported as "No
  changes". The summary now reports the changed contracts and their changes, and "No changes" is
  only shown when neither the core schema nor any contract changed.

- [#8275](https://github.com/graphql-hive/console/pull/8275)
  [`e967f76`](https://github.com/graphql-hive/console/commit/e967f7681933b035c88ad9323dde17e9a372bd69)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade `@theguild/federation-composition` to
  support oneOf directive in public sdl

  https://github.com/graphql-hive/federation-composition/releases/tag/v0.23.3

- [#8268](https://github.com/graphql-hive/console/pull/8268)
  [`7d21f6c`](https://github.com/graphql-hive/console/commit/7d21f6cbdace67df0041fdb77e683143e06e4076)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-mv8w-475r-vwqw](https://github.com/advisories/GHSA-mv8w-475r-vwqw).

- [#8268](https://github.com/graphql-hive/console/pull/8268)
  [`7d21f6c`](https://github.com/graphql-hive/console/commit/7d21f6cbdace67df0041fdb77e683143e06e4076)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-8pvw-jcv7-9cmj](https://github.com/advisories/GHSA-8pvw-jcv7-9cmj) and
  [GHSA-83w8-p2f5-377r](https://github.com/advisories/GHSA-83w8-p2f5-377r).

- [#8256](https://github.com/graphql-hive/console/pull/8256)
  [`0727b91`](https://github.com/graphql-hive/console/commit/0727b916b12b4e3c10e032d1ad6877519307c2ca)
  Thanks [@jdolle](https://github.com/jdolle)! - Track schema composition worker memory usage; add
  to schema service dashboard

- [#8262](https://github.com/graphql-hive/console/pull/8262)
  [`3925da7`](https://github.com/graphql-hive/console/commit/3925da717d4a8e532520d25307d8b504b10d54d8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilities
  [GHSA-45rx-2jwx-cxfr](https://github.com/advisories/GHSA-45rx-2jwx-cxfr), and
  [GHSA-c96f-x56v-gq3h](https://github.com/advisories/GHSA-c96f-x56v-gq3h).

- [#7966](https://github.com/graphql-hive/console/pull/7966)
  [`477bf11`](https://github.com/graphql-hive/console/commit/477bf11f6f242e6e5982a5821a6147342117542a)
  Thanks [@cosmincatalin](https://github.com/cosmincatalin)! - Add Azure Workload Identity
  Federation support for OIDC SSO in self-hosted deployments. Enabled organizations use the
  projected Azure token as a client assertion instead of an OIDC client secret.

  For example, enable federation for an organization with:

  ```env
  OIDC_WORKLOAD_FEDERATION_IDENTITY_PROVIDER=azure
  AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/tokens/azure-identity-token
  OIDC_WORKLOAD_FEDERATION_ORGANIZATION_IDS=00000000-0000-4000-8000-000000000000
  ```

  This will effectively override the client secret configured for that organization to use the OIDC
  provider.

- [#8259](https://github.com/graphql-hive/console/pull/8259)
  [`359ca59`](https://github.com/graphql-hive/console/commit/359ca5939f0160670981b9e735fa6fe6557fcd93)
  Thanks [@jdolle](https://github.com/jdolle)! - Optimize memory for composition worker stitching
  schemas. Don't store or build the schemas if there are stitched errors

## 11.7.1

### Patch Changes

- [#8253](https://github.com/graphql-hive/console/pull/8253)
  [`25d9ef3`](https://github.com/graphql-hive/console/commit/25d9ef3e0ebf547309129d3c9cf6aba6070b3559)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade `@graphql-tools/merge` and
  `@graphql-tools/stitch` packages.

- [#8242](https://github.com/graphql-hive/console/pull/8242)
  [`6ecfc46`](https://github.com/graphql-hive/console/commit/6ecfc46f357166a72a83740a3d710dc053cf1012)
  Thanks [@jdolle](https://github.com/jdolle)! - Reduce memory usage during stitching composition

## 11.7.0

### Minor Changes

- [#8079](https://github.com/graphql-hive/console/pull/8079)
  [`2b6d22f`](https://github.com/graphql-hive/console/commit/2b6d22f5d36c46e9bdc2425451fc96c5d42a0dbb)
  Thanks [@mish-elle](https://github.com/mish-elle)! - Added opt-in AWS IAM authentication for S3
  connections. When IAM is enabled, services authenticate to S3 using short-lived SigV4 pre-signed
  tokens instead of static passwords, since S3 connections are HTTP requests a new token will be
  generate for each call.

  ### New environment variables

  | Variable                            | Service | Description                                               |
  | ----------------------------------- | ------- | --------------------------------------------------------- |
  | `S3_AWS_IAM_AUTH_ENABLED`           | server  | Set to `1` to enable IAM authentication for S3.           |
  | `S3_MIRROR_AWS_IAM_AUTH_ENABLED`    | server  | Set to `1` to enable IAM authentication for S3 Mirror.    |
  | `S3_AUDIT_LOG_AWS_IAM_AUTH_ENABLED` | server  | Set to `1` to enable IAM authentication for S3 Audit Log. |

  ### To enable

  - `S3_*_AWS_IAM_AUTH_ENABLED=1`.
  - `S3_BUCKET_NAME` set to the AWS S3 bucket.
  - `S3_ENDPOINT` set with the S3 endpoint with the AWS Region (i.e.
    https://s3.us-east-1.amazonaws.com)

  When `CDN_API=1` is set on the server, the CDN artifact handler also uses IAM-authenticated S3
  clients. Adds support for S3 Audit Logs exported to AWS S3.

- [#8230](https://github.com/graphql-hive/console/pull/8230)
  [`e7e26b6`](https://github.com/graphql-hive/console/commit/e7e26b6e6c2260cd60c09a56435742139ea73a77)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support retries for deleting a schema in case the
  registry is busy and locked.

### Patch Changes

- [#8226](https://github.com/graphql-hive/console/pull/8226)
  [`c0873ac`](https://github.com/graphql-hive/console/commit/c0873ac45dfc893e7dd12115902bc7cdb2878419)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Clarify successful GitHub schema checks by
  annotating breaking changes that are safe based on usage or approved.

- [#8250](https://github.com/graphql-hive/console/pull/8250)
  [`6974b5e`](https://github.com/graphql-hive/console/commit/6974b5e6f8c8a792750450ad329b78b3f5d9f4a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) and
  [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx).

- [#8250](https://github.com/graphql-hive/console/pull/8250)
  [`6974b5e`](https://github.com/graphql-hive/console/commit/6974b5e6f8c8a792750450ad329b78b3f5d9f4a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-hrxh-6v49-42gf](https://github.com/advisories/GHSA-hrxh-6v49-42gf).

- [#8232](https://github.com/graphql-hive/console/pull/8232)
  [`78f4ed4`](https://github.com/graphql-hive/console/commit/78f4ed4d0fcef0dcf9a89b3a80a2ca1cd3d2e1e6)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric Alerts: enhance Grafana
  with additional panels for tracking filtered vs unfiltered rule and group population and attaches
  additional data to evaluate-group span

- [#8235](https://github.com/graphql-hive/console/pull/8235)
  [`91f971f`](https://github.com/graphql-hive/console/commit/91f971f8f0c51b6960f4b1d484cfbf87e037a8d4)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric Alerts optimization:
  Creates a new daily ClickHouse rollup and routes long-windowed rules/groups

- [#8250](https://github.com/graphql-hive/console/pull/8250)
  [`6974b5e`](https://github.com/graphql-hive/console/commit/6974b5e6f8c8a792750450ad329b78b3f5d9f4a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4).

- [#8243](https://github.com/graphql-hive/console/pull/8243)
  [`883d183`](https://github.com/graphql-hive/console/commit/883d183b68ad3100e3db9b5c5e3bcbbb7c5ee090)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix unexpected exception that could be raised when
  promoting a schema version within a monolithic project.

- [#8237](https://github.com/graphql-hive/console/pull/8237)
  [`68361c9`](https://github.com/graphql-hive/console/commit/68361c948180cf461aea4d04e1607407a8043344)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilities
  [GHSA-gcfj-64vw-6mp9](https://github.com/advisories/GHSA-gcfj-64vw-6mp9),
  [GHSA-hcpx-6fm6-wx23](https://github.com/advisories/GHSA-hcpx-6fm6-wx23),
  [GHSA-f4gw-2p7v-4548](https://github.com/advisories/GHSA-f4gw-2p7v-4548),
  [GHSA-mwf2-3pr3-8698](https://github.com/advisories/GHSA-mwf2-3pr3-8698),
  [GHSA-xj6q-8x83-jv6g](https://github.com/advisories/GHSA-xj6q-8x83-jv6g), and
  [GHSA-j3f2-48v5-ccww](https://github.com/advisories/GHSA-j3f2-48v5-ccww).

- [#8250](https://github.com/graphql-hive/console/pull/8250)
  [`6974b5e`](https://github.com/graphql-hive/console/commit/6974b5e6f8c8a792750450ad329b78b3f5d9f4a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-v245-v573-v5vm](https://github.com/advisories/GHSA-v245-v573-v5vm).

- [#8244](https://github.com/graphql-hive/console/pull/8244)
  [`7a99575`](https://github.com/graphql-hive/console/commit/7a9957504492bc414f363b973763e65a56bc4099)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support composing directive argument default values
  within the native composition.

  ```graphql
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.5", import: ["@key", "@composeDirective"])
    @link(url: "https://myspecs.dev/access/v1.0", import: ["@access"])
    @composeDirective(name: "@access")

  directive @access(scope: Scope! = PUBLIC) on FIELD_DEFINITION

  enum Scope {
    PUBLIC
    PRIVATE
  }

  type Query {
    hello: String @access
  }
  ```

  Previously, the `PUBLIC` default value in the above example would not be set in the composed
  result.

## 11.6.0

### Minor Changes

- [#8198](https://github.com/graphql-hive/console/pull/8198)
  [`156acee`](https://github.com/graphql-hive/console/commit/156aceead7e73ebbd5b201c7920d5d1c1d0e3f10)
  Thanks [@jdolle](https://github.com/jdolle)! - Use the monthly table in the usage estimator

  This table has dramatically better performance than operations_hourly.

### Patch Changes

- [#8218](https://github.com/graphql-hive/console/pull/8218)
  [`0564435`](https://github.com/graphql-hive/console/commit/05644359a4099b3344d19741c7b8248fde3e2a68)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric alerts optimization:
  Optimize evaluation cadence for long-windowed rule groups.

- [#8224](https://github.com/graphql-hive/console/pull/8224)
  [`60c14c0`](https://github.com/graphql-hive/console/commit/60c14c08e3b8a58c714d19a438032e1dd606152b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-25680](https://github.com/advisories/GHSA-5cv4-jp36-h3mw).

- [#8221](https://github.com/graphql-hive/console/pull/8221)
  [`5258d8e`](https://github.com/graphql-hive/console/commit/5258d8e0a4864a3ad57df60ee59444eef458fc4e)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric alerts optimization: Skip
  fetching the previous comparison window for groups that only contain absolute (fixed value) rules.

- [#8217](https://github.com/graphql-hive/console/pull/8217)
  [`e9bbbe6`](https://github.com/graphql-hive/console/commit/e9bbbe6a78f6fcd6dc9ebd99a43a7250786a84ef)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Metric alerts optimization:
  Require duration column selection only for rules of latency type.

- [#8224](https://github.com/graphql-hive/console/pull/8224)
  [`60c14c0`](https://github.com/graphql-hive/console/commit/60c14c08e3b8a58c714d19a438032e1dd606152b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-54285](https://github.com/advisories/GHSA-8988-4f7v-96qf).

- [#8228](https://github.com/graphql-hive/console/pull/8228)
  [`058c082`](https://github.com/graphql-hive/console/commit/058c08273c6aa24b0b0f3e7d4ff3d366869655e9)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade composition library to support oneOf
  directive without requiring composeDirective, and to fix an edge case where an external field is
  not flagged as external in the supergraph if another graph uses that field in the key

## 11.5.0

### Minor Changes

- [#8215](https://github.com/graphql-hive/console/pull/8215)
  [`608d931`](https://github.com/graphql-hive/console/commit/608d931663bfbee506511be376d6e3f3502f3e8b)
  Thanks [@jdolle](https://github.com/jdolle)! - Improve styling and visibility of composition
  report. This can be accessed through the project settings: composition tab when composition is
  flagged as incompatible

- [#8203](https://github.com/graphql-hive/console/pull/8203)
  [`45d99a6`](https://github.com/graphql-hive/console/commit/45d99a6e965e2736c542294f098a729bce1e4aa7)
  Thanks [@jdolle](https://github.com/jdolle)! - Role create and edit trigger validation on submit
  instead of disabling the submit button

### Patch Changes

- [#8213](https://github.com/graphql-hive/console/pull/8213)
  [`d6e9ebb`](https://github.com/graphql-hive/console/commit/d6e9ebb13b1f11dbdf0f79cc6a72f654e508668b)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Runs metric alerts cron with a
  concurrency pool

- [#8200](https://github.com/graphql-hive/console/pull/8200)
  [`fcfecb4`](https://github.com/graphql-hive/console/commit/fcfecb4cf26741accf14226201ba3476e5ccaedc)
  Thanks [@jdolle](https://github.com/jdolle)! - Security upgrades for dependencies (including ws,
  protobufjs, js-yaml, and others) to address security vulnerabilities. Upgrade nodejs from 24.14.1
  to 24.17.0

- [#8196](https://github.com/graphql-hive/console/pull/8196)
  [`27a58e5`](https://github.com/graphql-hive/console/commit/27a58e53c2c37998c2351c697288858a56f73287)
  Thanks [@jdolle](https://github.com/jdolle)! - Write s3 schema artifacts in parallel on schema
  publish. Previously, the subgraph SDLs would be written first and then the composite schema SDL
  would be written.

## 11.4.0

### Minor Changes

- [#8078](https://github.com/graphql-hive/console/pull/8078)
  [`bd6cce7`](https://github.com/graphql-hive/console/commit/bd6cce70b253deb676300e5e4ba063a6307e37cb)
  Thanks [@mish-elle](https://github.com/mish-elle)! - Added opt-in AWS IAM authentication for
  ElastiCache Redis connections and Redis Cluster mode support. When IAM is enabled, services
  authenticate to Redis using short-lived SigV4 pre-signed tokens instead of static passwords, with
  automatic token refresh before expiry.

  ### New environment variables

  | Variable                     | Service                                  | Description                                                                   |
  | ---------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
  | `AWS_REGION`                 | schema, server, tokens, usage, workflows | Default AWS region for all AWS connections.                                   |
  | `REDIS_AWS_IAM_AUTH_ENABLED` | schema, server, tokens, usage, workflows | Set to `1` to enable IAM authentication for Redis.                            |
  | `REDIS_AWS_IAM_CACHE_NAME`   | schema, server, tokens, usage, workflows | The ElastiCache Redis cache instance name. Used as the host for the signer.   |
  | `REDIS_AWS_REGION`           | schema, server, tokens, usage, workflows | Optional override for the Redis region (defaults to `AWS_REGION`).            |
  | `REDIS_CLUSTER_MODE_ENABLED` | schema, server, tokens, usage, workflows | Set to `1` to connect using Redis Cluster mode.                               |
  | `REDIS_USERNAME`             | schema, server, tokens, usage, workflows | Optional Redis username for ACL-based authentication (defaults to `default`). |

  ### To enable

  - `REDIS_AWS_IAM_AUTH_ENABLED=1`
  - `REDIS_TLS_ENABLED=1` must be set (IAM authentication requires TLS).
  - `REDIS_AWS_REGION` or `AWS_REGION` must be set.
  - `REDIS_AWS_IAM_CACHE_NAME` set to the name of the cache instance in AWS. This will be used as
    the hostname for the signer.
  - The pod/instance must have AWS credentials available (e.g. IRSA, EKS Pod Identity, instance
    profile) with the appropriate ElastiCache IAM permissions.

  ### Other changes

  - Bumping ioredis to `5.10.1`.

- [#8175](https://github.com/graphql-hive/console/pull/8175)
  [`dc800a8`](https://github.com/graphql-hive/console/commit/dc800a8a3e4c1ad7816ccd961090e2f1d38cd532)
  Thanks [@jdolle](https://github.com/jdolle)! - Introduce a new configuration option for selecting
  individual dangerous change types to consider breaking. This is useful because dangerous changes
  can be situational based on a team's accepted risk and deployment process.

### Patch Changes

- [#8183](https://github.com/graphql-hive/console/pull/8183)
  [`42c9d81`](https://github.com/graphql-hive/console/commit/42c9d818e8b12287cfc687ce8b2691d39103c164)
  Thanks [@jdolle](https://github.com/jdolle)! - Maintain scroll position on target explorer page
  when navigating back from another page

## 11.3.0

### Minor Changes

- [#8120](https://github.com/graphql-hive/console/pull/8120)
  [`065e087`](https://github.com/graphql-hive/console/commit/065e087a195320fab7cac8534129ee29fd578630)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Bump recommended clickhouse version for
  self-hosting to `26.3.12.3`.

  Pass `output_format_json_quote_64bit_integers=1` search parameter to clickhouse database queries
  expecting `JSON` responses to ensure consistent response output for different cloud providers.

  **Note:** Please ensure you are properly backing up your database and follow the Clickhouse
  changelog before using a newer ClickHouse version. We use `clickhouse/clickhouse-server` only for
  local development and integration testing. For production workloads, we recommend using a managed
  cloud service or having dedicated staff responsible for operating ClickHouse and planning
  upgrades.

### Patch Changes

- [#8110](https://github.com/graphql-hive/console/pull/8110)
  [`599c829`](https://github.com/graphql-hive/console/commit/599c8298dcbba58de21c5cb930e1a8289ddc3666)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix schema SDL not including directives when
  composing with schema stitching (impacting Federation projects). Bumped `@graphql-tools/stitch` to
  v10.1.22, [which contains a necessary bugfix](https://github.com/graphql-hive/gateway/pull/2401),
  and switched from `printSchema` to `printSchemaWithDirectives` when printing the stitched schema
  SDL.

- [#8121](https://github.com/graphql-hive/console/pull/8121)
  [`84d1f5c`](https://github.com/graphql-hive/console/commit/84d1f5c64f9654e2159ff84b2590dd79c9d51f33)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix issue where the user emails were not inserted
  in lower-case for OIDC providers returning non-lowercase emails.

  If you are affected, you can manually fix you database state by running the following commands, to
  make account-linking from different login methods work smoothly.

  ```sql
  UPDATE "users"
  SET
    "email" = lower("email")
  WHERE
    "email" <> lower("email");
  ```

  ```sql
  UPDATE "supertokens_thirdparty_users"
  SET
    "email" = lower("email")
  WHERE
    "email" <> lower("email");
  ```

  Fix issue where user emails were not inserted into the database in lowercase for invites,
  resulting in a mismatch of user account email and invite email that could not be accespted. To
  cleanup your database of invites, run the following command to identify duplicate records and then
  manually fix them/clean them up.

  ```sql
  SELECT
    "organization_id",
    lower(email) AS KEY,
    array_agg(
      json_object(
        ARRAY['email', 'code', 'expires_at'],
        ARRAY["email", "code", to_json("expires_at")::TEXT]
      )
    ) AS records,
    COUNT(*)
  FROM
    "organization_invitations"
  GROUP BY
    "organization_id",
    lower("email")
  HAVING
    COUNT(*) > 1;
  ```

## 11.2.1

### Patch Changes

- [#8094](https://github.com/graphql-hive/console/pull/8094)
  [`a98583d`](https://github.com/graphql-hive/console/commit/a98583dbb6e5c95a01718add659f1f0049c10efc)
  Thanks [@jdolle](https://github.com/jdolle)! - Include directives in output SDL for schema
  stitching projects

## 11.2.0

### Minor Changes

- [#8031](https://github.com/graphql-hive/console/pull/8031)
  [`51345a9`](https://github.com/graphql-hive/console/commit/51345a9c7487a7949a10b07d178836b02c7de197)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add support for promoting schema versions. This
  enables rollback and multi-environment promotions.

- [#8049](https://github.com/graphql-hive/console/pull/8049)
  [`548a597`](https://github.com/graphql-hive/console/commit/548a597e151d39e1222312f1f1a8ffcaa7721bf6)
  Thanks [@mish-elle](https://github.com/mish-elle)! - Add opt-in AWS IAM authentication for MSK
  (Kafka) connections. When enabled, services authenticate to Kafka using AWS IAM (SigV4) via the
  OAUTHBEARER SASL mechanism.

  ### New environment variables

  | Variable                     | Services              | Description                                                               |
  | ---------------------------- | --------------------- | ------------------------------------------------------------------------- |
  | `AWS_REGION`                 | usage, usage-ingestor | Default AWS region for the service for all AWS connections.               |
  | `KAFKA_AWS_IAM_AUTH_ENABLED` | usage, usage-ingestor | Set to `1` to enable IAM authentication.                                  |
  | `KAFKA_AWS_REGION`           | usage, usage-ingestor | Optional override for the Kafka broker region (defaults to `AWS_REGION`). |

  ### To enable

  - `KAFKA_AWS_IAM_AUTH_ENABLED=1`
  - `KAFKA_SSL=1` must be set (IAM authentication requires TLS).
  - `KAFKA_AWS_REGION` or `AWS_REGION` must be set.
  - The pod/instance must have AWS credentials available (e.g. IRSA, EKS Pod Identity, instance
    profile) with the appropriate MSK IAM permissions.

  ### Other changes

  - `KAFKA_BROKER` now accepts a comma-separated list of broker addresses (e.g.
    `broker1:9092,broker2:9092,broker3:9092`).

### Patch Changes

- [#8063](https://github.com/graphql-hive/console/pull/8063)
  [`19d3822`](https://github.com/graphql-hive/console/commit/19d38229730ea73dbd88a2ee7ac27fe35d92746a)
  Thanks [@saihaj](https://github.com/saihaj)! - add eviction policy to redis

- [#8067](https://github.com/graphql-hive/console/pull/8067)
  [`63da3d1`](https://github.com/graphql-hive/console/commit/63da3d1053a4c88c0dbda60eb0fcc0c5c97675fa)
  Thanks [@jdolle](https://github.com/jdolle)! - Only fetch SDL from the paginated schema checks
  query when one is requested

- [#8076](https://github.com/graphql-hive/console/pull/8076)
  [`f7334ff`](https://github.com/graphql-hive/console/commit/f7334ff7bdbcffcbe305c463831bf4b55dd46a3e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26)

- [#8074](https://github.com/graphql-hive/console/pull/8074)
  [`f66cf28`](https://github.com/graphql-hive/console/commit/f66cf28b9246b32e92e6d5b5dd1e3691d599744a)
  Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - drop redundant
  `sdl_store_unique_id` index via migration

- [#8057](https://github.com/graphql-hive/console/pull/8057)
  [`5c76de1`](https://github.com/graphql-hive/console/commit/5c76de1fb87ee003d65a110b4656a2519abc038f)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Fix exception for access token without
  description.

## 11.1.1

### Patch Changes

- [#8044](https://github.com/graphql-hive/console/pull/8044)
  [`ce4d445`](https://github.com/graphql-hive/console/commit/ce4d445f3c2a2d214b7c47e35c9a38f4de7c3f0e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-q6x5-8v7m-xcrf](https://github.com/advisories/GHSA-q6x5-8v7m-xcrf),
  [GHSA-jvwf-75h9-cwgg](https://github.com/advisories/GHSA-jvwf-75h9-cwgg),
  [GHSA-75px-5xx7-5xc7](https://github.com/advisories/GHSA-75px-5xx7-5xc7),
  [GHSA-66ff-xgx4-vchm](https://github.com/advisories/GHSA-66ff-xgx4-vchm),
  [GHSA-685m-2w69-288q](https://github.com/advisories/GHSA-685m-2w69-288q),
  [GHSA-2pr8-phx7-x9h3](https://github.com/advisories/GHSA-2pr8-phx7-x9h3) and
  [GHSA-fx83-v9x8-x52w](https://github.com/advisories/GHSA-fx83-v9x8-x52w).

## 11.1.0

### Minor Changes

- [#8015](https://github.com/graphql-hive/console/pull/8015)
  [`80b7600`](https://github.com/graphql-hive/console/commit/80b76004da822f9f526fef3160b51c834865d266)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Write app deployment manifest to CDN upon app
  activation and retirement. The app deployment manifest can be used to discover what hashes belong
  to an app deployment version.

- [#7982](https://github.com/graphql-hive/console/pull/7982)
  [`63e6827`](https://github.com/graphql-hive/console/commit/63e682791fbb3c53f05e34329043c8fc8b705189)
  Thanks [@jetocotoje](https://github.com/jetocotoje)! - Add configuration for specifying services
  listening host. It is now possible to specify on which host the services are listening.
  Furthermore, the services can be configured to only listing on IPv6.

  The behaviour can be configrued via the two new environment variables `SERVER_HOST` and
  `SERVER_HOST_IPV6_ONLY` for each service.

  ```
  SERVER_HOST="::"
  SERVER_HOST_IPV6_ONLY="0"
  ```

### Patch Changes

- [#8020](https://github.com/graphql-hive/console/pull/8020)
  [`a989647`](https://github.com/graphql-hive/console/commit/a989647908ad7635831d7bd753076fb12f98dbe8)
  Thanks [@jdolle](https://github.com/jdolle)! - OIDC verification domains are now inserted and
  compared against lowercase domains. Any existing domains that use an uppercase letter must be
  converted to lowercase. This is to avoid an unnecessary convert to LOWER() in the SQL statements.

  To convert existing domains, run the SQL query:

  ```
  UPDATE oidc_integration_domains
  SET domain_name=LOWER(domain_name)
  WHERE domain_name != LOWER(domain_name)
  ;
  ```

- [#8040](https://github.com/graphql-hive/console/pull/8040)
  [`931c327`](https://github.com/graphql-hive/console/commit/931c3274bf69984d00a3db3e6e20adcfcd39ad4b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilityies
  [GHSA-q7rr-3cgh-j5r3](https://github.com/advisories/GHSA-q7rr-3cgh-j5r3).

- [#8035](https://github.com/graphql-hive/console/pull/8035)
  [`0cd6cc5`](https://github.com/graphql-hive/console/commit/0cd6cc5606e8cf3c952583feec956c8f024ee615)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-pf86-5x62-jrwf](https://github.com/advisories/GHSA-pf86-5x62-jrwf)

- [#8021](https://github.com/graphql-hive/console/pull/8021)
  [`51e5baa`](https://github.com/graphql-hive/console/commit/51e5baa0dd42b9a5fcd499e60f03baa0c45c8da9)
  Thanks [@jdolle](https://github.com/jdolle)! - "INPUT_FIELD_ADDED" is now classified as Dangerous
  (was NonBreaking) when the added field has a default value, since rolling deploys can expose
  consumers to the default before producers are ready.

- [#8035](https://github.com/graphql-hive/console/pull/8035)
  [`0cd6cc5`](https://github.com/graphql-hive/console/commit/0cd6cc5606e8cf3c952583feec956c8f024ee615)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-5wm8-gmm8-39j9](https://github.com/advisories/GHSA-5wm8-gmm8-39j9)

- [#8035](https://github.com/graphql-hive/console/pull/8035)
  [`0cd6cc5`](https://github.com/graphql-hive/console/commit/0cd6cc5606e8cf3c952583feec956c8f024ee615)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6)

## 11.0.4

### Patch Changes

- [#8016](https://github.com/graphql-hive/console/pull/8016)
  [`d0f3ef0`](https://github.com/graphql-hive/console/commit/d0f3ef04f5d1ffc70fdb7af2114cc7a5649ee763)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix Federation composition rule
  `REQUIRED_INACCESSIBLE` reporting a composition error if `@inaccessible` is applied on a
  non-nullable field with a default value.

  In the following example schema the `Query.ping(message:)` argument no longer raises
  `REQUIRED_INACCESSIBLE`, as a default value for the argument is provided. The same behaviour
  applies for input type fields.

  ```graphql
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@inaccessible"])

  type Query {
    ping(message: String! = "pong" @inaccessible): String!
  }
  ```

- [#8003](https://github.com/graphql-hive/console/pull/8003)
  [`bea8b7c`](https://github.com/graphql-hive/console/commit/bea8b7c4f62be5e704c8709a50ae3ea7d0466fe3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-gh4j-gqv2-49f6](https://github.com/advisories/GHSA-gh4j-gqv2-49f6).

- [#8004](https://github.com/graphql-hive/console/pull/8004)
  [`c2d8360`](https://github.com/graphql-hive/console/commit/c2d83604b59b1f96c3382049c8a523d1fc0fd110)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix various links to documentation pages.

- [#8003](https://github.com/graphql-hive/console/pull/8003)
  [`bea8b7c`](https://github.com/graphql-hive/console/commit/bea8b7c4f62be5e704c8709a50ae3ea7d0466fe3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## 11.0.3

### Patch Changes

- [#7993](https://github.com/graphql-hive/console/pull/7993)
  [`730771f`](https://github.com/graphql-hive/console/commit/730771fb503fd91974c1494944cd5426cf74a552)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-72c6-fx6q-fr5w](https://github.com/advisories/GHSA-72c6-fx6q-fr5w).

- [#7988](https://github.com/graphql-hive/console/pull/7988)
  [`d7e7025`](https://github.com/graphql-hive/console/commit/d7e7025624ba66459515778c0724a58397a5f1b4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-247c-9743-5963](https://github.com/advisories/GHSA-247c-9743-5963).

- [#7961](https://github.com/graphql-hive/console/pull/7961)
  [`40fd27d`](https://github.com/graphql-hive/console/commit/40fd27d9c060df5417c18c750b02af65451e5323)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update
  [`nodemailer`](https://github.com/nodemailer/nodemailer) to address vulnerability
  [GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g).

- [#7993](https://github.com/graphql-hive/console/pull/7993)
  [`730771f`](https://github.com/graphql-hive/console/commit/730771fb503fd91974c1494944cd5426cf74a552)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-v9ww-2j6r-98q6](https://github.com/advisories/GHSA-v9ww-2j6r-98q6).

- [#7976](https://github.com/graphql-hive/console/pull/7976)
  [`ed9ab34`](https://github.com/graphql-hive/console/commit/ed9ab34c705be4b7946dfcbede91926f00f1ed4a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - address vulnerability
  [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653)

- [#7967](https://github.com/graphql-hive/console/pull/7967)
  [`9708f71`](https://github.com/graphql-hive/console/commit/9708f71aa3e6dcd613f3877a0777c1e72710b200)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix schema contract composition applying
  `@inaccessible` on the federation types `ContextArgument` and `FieldValue` on the supergraph SDL.

  This mitigates the following error in apollo-router upon processing the supergraph:

  ```
  could not create router: Api error(s): The supergraph schema failed to produce a valid API schema: The following errors occurred:
    - Core feature type `join__ContextArgument` cannot use @inaccessible.
    - Core feature type `join__FieldValue` cannot use @inaccessible.
  ```

- [#7993](https://github.com/graphql-hive/console/pull/7993)
  [`730771f`](https://github.com/graphql-hive/console/commit/730771fb503fd91974c1494944cd5426cf74a552)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg).

- [#7978](https://github.com/graphql-hive/console/pull/7978)
  [`9c6989c`](https://github.com/graphql-hive/console/commit/9c6989cd929df3b071cba2c5652cc18988127897)
  Thanks [@jdolle](https://github.com/jdolle)! - Add schema linting support for type extensions

- [#7993](https://github.com/graphql-hive/console/pull/7993)
  [`730771f`](https://github.com/graphql-hive/console/commit/730771fb503fd91974c1494944cd5426cf74a552)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-6414](https://github.com/advisories/GHSA-x428-ghpx-8j92).

- [#7988](https://github.com/graphql-hive/console/pull/7988)
  [`d7e7025`](https://github.com/graphql-hive/console/commit/d7e7025624ba66459515778c0724a58397a5f1b4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-39q2-94rc-95cp](https://github.com/advisories/GHSA-39q2-94rc-95cp).

- [#7980](https://github.com/graphql-hive/console/pull/7980)
  [`c46b2f2`](https://github.com/graphql-hive/console/commit/c46b2f221936ca60e49bce3a2fea25bb40378266)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-fvcv-3m26-pcqx](https://github.com/advisories/GHSA-fvcv-3m26-pcqx).

- [#7993](https://github.com/graphql-hive/console/pull/7993)
  [`730771f`](https://github.com/graphql-hive/console/commit/730771fb503fd91974c1494944cd5426cf74a552)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-6410](https://github.com/advisories/GHSA-pr96-94w5-mx2h).

- [#7961](https://github.com/graphql-hive/console/pull/7961)
  [`40fd27d`](https://github.com/graphql-hive/console/commit/40fd27d9c060df5417c18c750b02af65451e5323)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update
  [`opentelemetry-go`](https://github.com/open-telemetry/opentelemetry-go) to address vulnerability
  [CVE-2026-39883](https://github.com/advisories/GHSA-hfvc-g4fc-pqhx).

## 11.0.2

### Patch Changes

- [#7940](https://github.com/graphql-hive/console/pull/7940)
  [`742f50c`](https://github.com/graphql-hive/console/commit/742f50c52e846ab63843635c6f408016a30f6288)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix lint policy block title color; add policy link
  to lines and rule id tooltip

- [#7936](https://github.com/graphql-hive/console/pull/7936)
  [`96bd390`](https://github.com/graphql-hive/console/commit/96bd390c7ffa75baf7db0c0bb3a3117c6ef6f631)
  Thanks [@jdolle](https://github.com/jdolle)! - Do not cache edge types in graphql eslint. This
  fixes an issue where edge types were cached between runs and only the cached edge types would be
  referenced for subsequent runs

## 11.0.1

### Patch Changes

- [#7909](https://github.com/graphql-hive/console/pull/7909)
  [`484054b`](https://github.com/graphql-hive/console/commit/484054be2773431a419be2c5ab16742f81d6b895)
  Thanks [@jdolle](https://github.com/jdolle)! - Support project level token expiration

- [#7908](https://github.com/graphql-hive/console/pull/7908)
  [`70b3e19`](https://github.com/graphql-hive/console/commit/70b3e19fe2e6e064f5693f8acfbfcae8182faac4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix web app pagination for access tokens.

- [#7893](https://github.com/graphql-hive/console/pull/7893)
  [`e5711a5`](https://github.com/graphql-hive/console/commit/e5711a52a87b9e66147de08378f8c3d17336d175)
  Thanks [@jdolle](https://github.com/jdolle)! - Add expiration to all tokens; fix token ui spacing
  issues

## 11.0.0

### Major Changes

- [#7837](https://github.com/graphql-hive/console/pull/7837)
  [`c00ea50`](https://github.com/graphql-hive/console/commit/c00ea5091c4ce9c939f1072876e6ebc4e991b1eb)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improved performance when looking up affected app
  deployments for breaking change detection.

  **BREAKING CHANGE**

  This release introduces a breaking change because it depends on a manual database migration
  introduced in `10.1.0`.

  If you use the app deployments feature for conditional breaking change detection, you should:

  1. Upgrade to `10.1.0`
  2. Perform the manual database migration steps described in that version
  3. Then upgrade to this release

  **Alternative upgrade path**

  If you want to avoid performing the manual database migration:

  1. Upgrade to `10.1.0`
  2. Wait until all app deployments created **before** the rollout of `10.1.0` are retired
  3. Then upgrade to this release

### Patch Changes

- [#7866](https://github.com/graphql-hive/console/pull/7866)
  [`66a4f6b`](https://github.com/graphql-hive/console/commit/66a4f6bef8818dc160fce7e83e446063c262e2fc)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix legacy member scope mappings granting access to
  deleting projects.

## 10.2.0

### Minor Changes

- [#7859](https://github.com/graphql-hive/console/pull/7859)
  [`bf00fbc`](https://github.com/graphql-hive/console/commit/bf00fbcc2d35278b9be46431f4a0c339a29f6de7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve federation composition

  - Support `file:` protocol and non-RFC 3986 in imported `link` url arguments
  - Fix supergraph `@join__field` emission for Federation v1 `@external` fields and improve
    `override`/`requires` edge-case handling.
    - Drop Federation v1 `@join__field(external: true)` fields based on key usage in the subgraph
      instead of aggregated field key usage across subgraphs.
    - Avoid emitting redundant `@join__field(external: true)` metadata when a field is only required
      through overridden paths.
    - Tighten `@join__field` emission around @override and interface type fields.

### Patch Changes

- [#7852](https://github.com/graphql-hive/console/pull/7852)
  [`67b5949`](https://github.com/graphql-hive/console/commit/67b5949ce7d87d6b3cbeb946dbf7479925a19e19)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve access checks for deleting legacy target
  tokens.

## 10.1.0

### Minor Changes

- [#7832](https://github.com/graphql-hive/console/pull/7832)
  [`d9f2d51`](https://github.com/graphql-hive/console/commit/d9f2d51f59b16bd30dc0bec47671090e64801b7b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Create new ClickHouse materialized views for faster
  affected app deployment lookups in schema checks and schema version.

  **Caution**: If you are relying on the app deployments feature for schema checks it is recommended
  to manually perform the following migration against your ClickHouse database after deploying this
  version to ensure data consistency.

  Substitute `$CLICKHOUSE_DB_USER` and `$CLICKHOUSE_DB_PASSWORD`, with the same credentials that
  execute these migration.

  ```sql
  CREATE TABLE "tmp_app_deployments_backfill_target_id" (
    "app_deployment_id" STRING,
    "target_id" LowCardinality (STRING)
  ) ENGINE = Memory;
  
  INSERT INTO
    "tmp_app_deployments_backfill_target_id"
  SELECT
    "app_deployment_id",
    "target_id"
  FROM
    "app_deployments";
  
  CREATE DICTIONARY "tmp_app_deployments_target_dict" ("app_deployment_id" STRING, "target_id" STRING) PRIMARY KEY "app_deployment_id" SOURCE (
    CLICKHOUSE (
      TABLE "tmp_app_deployments_backfill_target_id" USER '$CLICKHOUSE_DB_USER' PASSWORD '$CLICKHOUSE_DB_PASSWORD'
    )
  ) LAYOUT (HASHED ()) LIFETIME (3600);
  
  ALTER TABLE "app_deployment_documents"
  UPDATE "target_id" = dictGetString (
    'tmp_app_deployments_target_dict',
    'target_id',
    "app_deployment_id"
  )
  WHERE
    "target_id" = '';
  
  INSERT INTO
    "app_deployment_document_coordinates" (
      "target_id",
      "coordinate",
      "app_deployment_id",
      "document_hash",
      "operation_name"
    )
  SELECT
    "target_id",
    arrayJoin ("schema_coordinates") AS "schema_coordinate",
    "app_deployment_id",
    "document_hash",
    "operation_name"
  FROM
    "app_deployment_documents"
  WHERE
    "target_id" != "";
  
  DROP DICTIONARY "tmp_app_deployments_target_dict";
  
  DROP TABLE "tmp_app_deployments_backfill_target_id";
  ```

### Patch Changes

- [#7851](https://github.com/graphql-hive/console/pull/7851)
  [`219cac8`](https://github.com/graphql-hive/console/commit/219cac8c4d6e3ee01c28da307c7971cce884bc2c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix access token expiration date.

## 10.0.0

### Major Changes

- [#7705](https://github.com/graphql-hive/console/pull/7705)
  [`14c73e5`](https://github.com/graphql-hive/console/commit/14c73e57513b5b0df8faa2aca8f4a1eb84088b7c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - **BREAKING** Remove support for `supertokens`
  service and replace it with native authentication solution.

  ## Upgrade Guide

  Adjust your docker compose file like the following:

  - Remove `services.supertokens` from your `docker-compose.community.yml` file
  - Remove the following environment variables from the `services.server.environment`
    - `SUPERTOKENS_CONNECTION_URI=`
    - `SUPERTOKENS_API_KEY=`
  - Set the following environment variables for `services.server.environment`
    - `SUPERTOKENS_REFRESH_TOKEN_KEY=`
    - `SUPERTOKENS_ACCESS_TOKEN_KEY=`

  ### Set the refresh token key

  #### Extract from existing `supertokens` deployment

  This method works if you use supertokens before and want to have existing user sessions to
  continue working. If you want to avoid messing with the database, you can also create a new
  refresh token key from scratch, the drawback is that users are forced to login again.

  Extract the refresh token key from the supertokens database

  ```sql
  SELECT
    "value"
  FROM
    "supertokens_key_value"
  WHERE
    "name" = 'refresh_token_key';
  ```

  The key should look similar to this:
  `1000:15e5968d52a9a48921c1c63d88145441a8099b4a44248809a5e1e733411b3eeb80d87a6e10d3390468c222f6a91fef3427f8afc8b91ea1820ab10c7dfd54a268:39f72164821e08edd6ace99f3bd4e387f45fa4221fe3cd80ecfee614850bc5d647ac2fddc14462a00647fff78c22e8d01bc306a91294f5b889a90ba891bf0aa0`

  Update the docker compose `services.server.environment.SUPERTOKENS_REFRESH_TOKEN_KEY` environment
  variable value to this string.

  #### Create from scratch

  Run the following command to create a new refresh key from scratch:

  ```sh
  echo "1000:$(openssl rand -hex 64):$(openssl rand -hex 64)"
  ```

  ### Set the access token key

  Generate a new access token key using the following instructions:

  ```sh
  # 1. Generate a unique key name. 'uuidgen' is great for this.
  #    You can replace this with any string you like, e.g., KEY_NAME="my-app-key-1"
  KEY_NAME=$(uuidgen)
  # 2. Generate a 2048-bit RSA private key in PEM format, held in memory.
  PRIVATE_KEY_PEM=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048)
  # 3. Extract the corresponding public key from the private key, also held in memory.
  PUBLIC_KEY_PEM=$(echo "$PRIVATE_KEY_PEM" | openssl rsa -pubout)
  # 4. Strip the headers/footers and newlines from the private key PEM
  #    to get just the raw Base64 data.
  PRIVATE_KEY_DATA=$(echo "$PRIVATE_KEY_PEM" | awk 'NF {if (NR!=1 && $0!~/-----END/) print}' | tr -d '\n')
  # 5. Do the same for the public key PEM.
  PUBLIC_KEY_DATA=$(echo "$PUBLIC_KEY_PEM" | awk 'NF {if (NR!=1 && $0!~/-----END/) print}' | tr -d '\n')
  # 6. Echo the final formatted string to the console.
  echo "${KEY_NAME}|${PUBLIC_KEY_DATA}|${PRIVATE_KEY_DATA}"
  ```

  Update the docker compose `services.server.environment.SUPERTOKENS_ACCESS_TOKEN_KEY` environment
  variable value to the formatted string output.

  ## Conclusion

  After performing this updates you can run Hive Console without the need for the `supertokens`
  service. All the relevant authentication logic resides within the `server` container instead.

  Existing users in the supertokens system will continue to exist when running without the
  `supertokens` service.

### Patch Changes

- [#7836](https://github.com/graphql-hive/console/pull/7836)
  [`f42b83a`](https://github.com/graphql-hive/console/commit/f42b83a57efbb963f17ab764e8e5100aa4330320)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Suppress Monaco editor errors
  before sending to Sentry

## 9.7.1

### Patch Changes

- [#7828](https://github.com/graphql-hive/console/pull/7828)
  [`1b31761`](https://github.com/graphql-hive/console/commit/1b31761cc3f94693ad74498f70cf89faff373b2f)
  Thanks [@jdolle](https://github.com/jdolle)! - Adjust app deployment schema check to perform
  database queries in parallel

## 9.7.0

### Minor Changes

- [#7745](https://github.com/graphql-hive/console/pull/7745)
  [`33bff41`](https://github.com/graphql-hive/console/commit/33bff4134240964bbf3bd97b878572202c13c256)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Allow organization owners register domain
  ownership. The registration will allow users with matching email domains bypassing mandatory email
  verification.

### Patch Changes

- [#7810](https://github.com/graphql-hive/console/pull/7810)
  [`7aac422`](https://github.com/graphql-hive/console/commit/7aac422acc3ef13ec1c199259f5c9c4522481c6f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Propagate updated email address from OIDC provider.
  This fixes a bug where a user was locked out of the Hive account after the email of the user on
  the OIDC provider side changed.

- [#7812](https://github.com/graphql-hive/console/pull/7812)
  [`2c55d5b`](https://github.com/graphql-hive/console/commit/2c55d5bd1188bc003ccf537095b9813127928693)
  Thanks [@jdolle](https://github.com/jdolle)! - Explorer page unions now link to the contained
  types

## 9.6.1

### Patch Changes

- [#7792](https://github.com/graphql-hive/console/pull/7792)
  [`56086ba`](https://github.com/graphql-hive/console/commit/56086ba42ee301e95a59ec2d7ceec0753063fced)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-24051](https://github.com/graphql-hive/console/security/dependabot/517)

- [#7768](https://github.com/graphql-hive/console/pull/7768)
  [`6b22c3d`](https://github.com/graphql-hive/console/commit/6b22c3d9e2c90585b6680fb9bc8eed60fe878549)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Enhanced Insights filters UI with
  include/exclude options

- [#7792](https://github.com/graphql-hive/console/pull/7792)
  [`56086ba`](https://github.com/graphql-hive/console/commit/56086ba42ee301e95a59ec2d7ceec0753063fced)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-3419](https://github.com/graphql-hive/console/security/dependabot/536)

- [#7797](https://github.com/graphql-hive/console/pull/7797)
  [`bb74982`](https://github.com/graphql-hive/console/commit/bb74982825d3f7d31c6d6345cf586617cbe728e8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Revert improvements around federation composition
  rules introduced in `9.6.1` as it might cause issues for Apollo Gateway.

- [#7795](https://github.com/graphql-hive/console/pull/7795)
  [`4fef6c7`](https://github.com/graphql-hive/console/commit/4fef6c759d2c82bbc9ac8128f1e56ba31d0e21ca)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [CVE-2026-0540](https://github.com/graphql-hive/console/security/dependabot/523)

## 9.6.0

### Minor Changes

- [#7769](https://github.com/graphql-hive/console/pull/7769)
  [`ee2785c`](https://github.com/graphql-hive/console/commit/ee2785c4cc63922bbd45f2557cc6d1e5577c6cca)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - App deployments are now stable and enabled for all
  organizations by default.

### Patch Changes

- [#7773](https://github.com/graphql-hive/console/pull/7773)
  [`e3532f2`](https://github.com/graphql-hive/console/commit/e3532f21a31b8510c95c899112a9b21c20d46e69)
  Thanks [@jdolle](https://github.com/jdolle)! - Add `schemaCheck:approve` permission to
  organization access token list

- [#7778](https://github.com/graphql-hive/console/pull/7778)
  [`3c05b96`](https://github.com/graphql-hive/console/commit/3c05b96a10f24c11e24c724e2418eb1944a73b59)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve federation composition rules.

  - Fix supergraph `@join__field` generation for `@override` + `@requires` migrations and add a
    progressive override restriction.
  - When a field with `@requires` is overridden, composition now ignores `@requires` usage coming
    only from the overridden source field when deciding whether to keep
    `@join__field(..., external: true)`. This prevents stale external annotations in the supergraph.
  - Progressive override (`@override(..., label: ...)`) is now rejected when the overridden source
    field uses `@requires` (error code: `OVERRIDE_COLLISION_WITH_ANOTHER_DIRECTIVE`).
    Non-progressive override behavior is unchanged.

## 9.5.0

### Minor Changes

- [#7699](https://github.com/graphql-hive/console/pull/7699)
  [`5f88ce8`](https://github.com/graphql-hive/console/commit/5f88ce8bd8c68ea198fcec3c6f17ac957436b5e7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add experimental support for running without
  `supertokens` service.

  ## Instructions

  ### Prerequisites

  Adjust your docker compose file like the following:

  - Remove `services.supertokens` from your `docker-compose.community.yml` file
  - Remove the following environment variables from the `services.server.environment`
    - `SUPERTOKENS_CONNECTION_URI=`
    - `SUPERTOKENS_API_KEY=`
  - Set the following environment variables for `services.server.environment`
    - `SUPERTOKENS_AT_HOME=1`
    - `SUPERTOKENS_REFRESH_TOKEN_KEY=`
    - `SUPERTOKENS_ACCESS_TOKEN_KEY=`
  - Set the following environment variables for `services.migrations.environment`
    - `SUPERTOKENS_AT_HOME=1`

  ### Set the refresh token key

  #### Extract from existing `supertokens` deployment

  This method works if you use supertokens before and want to have existing user sessions to
  continue working. If you want to avoid messing with the database, you can also create a new
  refresh token key from scratch, the drawback is that users are forced to login again.

  Extract the refresh token key from the supertokens database

  ```sql
  SELECT
    "value"
  FROM
    "supertokens_key_value"
  WHERE
    "name" = 'refresh_token_key';
  ```

  The key should look similar to this:
  `1000:15e5968d52a9a48921c1c63d88145441a8099b4a44248809a5e1e733411b3eeb80d87a6e10d3390468c222f6a91fef3427f8afc8b91ea1820ab10c7dfd54a268:39f72164821e08edd6ace99f3bd4e387f45fa4221fe3cd80ecfee614850bc5d647ac2fddc14462a00647fff78c22e8d01bc306a91294f5b889a90ba891bf0aa0`

  Update the docker compose `services.server.environment.SUPERTOKENS_REFRESH_TOKEN_KEY` environment
  variable value to this string.

  #### Create from scratch

  Run the following command to create a new refresh key from scratch:

  ```sh
  echo "1000:$(openssl rand -hex 64):$(openssl rand -hex 64)"
  ```

  Update the docker compose `services.server.environment.SUPERTOKENS_REFRESH_TOKEN_KEY` environment
  variable value to this string.

  ### Set the access token key

  Generate a new access token key using the following instructions:

  ```sh
  # 1. Generate a unique key name. 'uuidgen' is great for this.
  #    You can replace this with any string you like, e.g., KEY_NAME="my-app-key-1"
  KEY_NAME=$(uuidgen)
  # 2. Generate a 2048-bit RSA private key in PEM format, held in memory.
  PRIVATE_KEY_PEM=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048)
  # 3. Extract the corresponding public key from the private key, also held in memory.
  PUBLIC_KEY_PEM=$(echo "$PRIVATE_KEY_PEM" | openssl rsa -pubout)
  # 4. Strip the headers/footers and newlines from the private key PEM
  #    to get just the raw Base64 data.
  PRIVATE_KEY_DATA=$(echo "$PRIVATE_KEY_PEM" | awk 'NF {if (NR!=1 && $0!~/-----END/) print}' | tr -d '\n')
  # 5. Do the same for the public key PEM.
  PUBLIC_KEY_DATA=$(echo "$PUBLIC_KEY_PEM" | awk 'NF {if (NR!=1 && $0!~/-----END/) print}' | tr -d '\n')
  # 6. Echo the final formatted string to the console.
  echo "${KEY_NAME}|${PUBLIC_KEY_DATA}|${PRIVATE_KEY_DATA}"
  ```

  Update the docker compose `services.server.environment.SUPERTOKENS_ACCESS_TOKEN_KEY` environment
  variable value to the formatted string output.

  ## Conclusion

  After performing this updates you can run Hive Console without the need for the `supertokens`
  service. All the relevant authentication logic resides within the `server` container instead.

  Existing users in the supertokens system will continue to exist when running without the
  `supertokens` service.

- [#7706](https://github.com/graphql-hive/console/pull/7706)
  [`9357d39`](https://github.com/graphql-hive/console/commit/9357d3964624cfe963b95d437113a6b26a03934b)
  Thanks [@jdolle](https://github.com/jdolle)! - We continue to build and expand the features of
  schema proposals. In this change, a background composition job was added to allow asynchronous
  updates to the composition state of a proposal. This composition job uses the schema service's
  composer but is unique from checks in that it takes the latest state of all subgraphs that are a
  part of a schema proposal.

  ### Additional environment variables for `workflows` service:

  The `workflow` service calls the `schema` service's composeAndValidate TRPC endpoint and requires
  the `schema` service endpoint. And the shared instance of Redis, used as a pubsub in the `server`
  and `api` services, is also now used by `workflows` to update
  `Subscription.schemaProposalComposition`.

  For self hosters, make sure to provide the following environment variables to the `workflows`
  service:

  - SCHEMA_ENDPOINT
  - REDIS_HOST
  - REDIS_PORT
  - REDIS_PASSWORD

### Patch Changes

- [#7761](https://github.com/graphql-hive/console/pull/7761)
  [`14581ba`](https://github.com/graphql-hive/console/commit/14581baf69543afb4ecf524f21c2f6d6d1d823d5)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Correctly display permission group without assigned
  resources.

- [#7700](https://github.com/graphql-hive/console/pull/7700)
  [`d777e32`](https://github.com/graphql-hive/console/commit/d777e3252ae54f2b2ee10bb431a73e3a9489e590)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add server-side sorting to app
  deployments table (Created, Activated, Last Used).

- [#7677](https://github.com/graphql-hive/console/pull/7677)
  [`c3cb1ac`](https://github.com/graphql-hive/console/commit/c3cb1acc5c13522ace544aceb240bb54df2c7917)
  Thanks [@jdolle](https://github.com/jdolle)! - Increase service keepAliveTimeout from 72s to 905s

- [#7746](https://github.com/graphql-hive/console/pull/7746)
  [`ade45f5`](https://github.com/graphql-hive/console/commit/ade45f5a70727df55402125cf73779009253962a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - fix unexpected error for support tickets in case
  the user already exists within zendesk.

- [#7673](https://github.com/graphql-hive/console/pull/7673)
  [`f8aac8b`](https://github.com/graphql-hive/console/commit/f8aac8b98c5d65d3507597e2cc223a4e1f484887)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Handle OIDC token exchange errors
  gracefully instead of returning 500. Classifies OAuth 2.0 error codes into user-safe messages
  without leaking sensitive provider details. Fix OIDC debug log modal not displaying the log area.

- [#7732](https://github.com/graphql-hive/console/pull/7732)
  [`3567483`](https://github.com/graphql-hive/console/commit/3567483fbd4ddc51ddddd4c4886cc12d251cdbca)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - fix: correct RPM chart Y-axis
  scale to match actual values

## 9.4.1

### Patch Changes

- [#7664](https://github.com/graphql-hive/console/pull/7664)
  [`ddea09b`](https://github.com/graphql-hive/console/commit/ddea09bbc34f5486fa6ddddf4e60a899fc7f43b5)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix service SDL being printed on a single line in
  check and publish views

- [#7688](https://github.com/graphql-hive/console/pull/7688)
  [`fb14a99`](https://github.com/graphql-hive/console/commit/fb14a990871456730c7a5da92d157962fb0599a7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix unexpected error when attempting to select
  resources in a project without app deployments/services

- [#7687](https://github.com/graphql-hive/console/pull/7687)
  [`c514e23`](https://github.com/graphql-hive/console/commit/c514e237daa125d8e64d350218ea553fbf4e44a3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Gracefully handle error when publish lock
  acquisition fails for clients not supporting retries.

- [#7670](https://github.com/graphql-hive/console/pull/7670)
  [`8138a6c`](https://github.com/graphql-hive/console/commit/8138a6cb381f1f92eb514c0c9125d3c15df3e9b3)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Hive Lab: Better initial state handling
  for env variables in preflight script

- [#7672](https://github.com/graphql-hive/console/pull/7672)
  [`21f3aee`](https://github.com/graphql-hive/console/commit/21f3aeeb2a914f8da4bdc913aead3a9400bf75f4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix "see organization as admin" mode for debugging
  purposes.

- [#7675](https://github.com/graphql-hive/console/pull/7675)
  [`30238d7`](https://github.com/graphql-hive/console/commit/30238d700b5b094358ebcd13f13b025b9fb33fe1)
  Thanks [@jdolle](https://github.com/jdolle)! - Add missing message for no details on schema
  check/push changes

- [#7669](https://github.com/graphql-hive/console/pull/7669)
  [`a6f5ac4`](https://github.com/graphql-hive/console/commit/a6f5ac4cc61f7c5eee68768c3f82140cb0290dc1)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add `lastUsed`, `createdAt`,
  `activatedAt`, and `status` columns to app deployments tables. Fix broken text colors on multiple
  pages after the recent color palette overhaul.

## 9.4.0

### Minor Changes

- [#7635](https://github.com/graphql-hive/console/pull/7635)
  [`6c6f5ab`](https://github.com/graphql-hive/console/commit/6c6f5ab5f25a19ca5f2a7f1016ae1bd967542bc8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `Mutation.updateSchemaComposition` to the
  public GraphQL API schema.

- [#7642](https://github.com/graphql-hive/console/pull/7642)
  [`a65b0bc`](https://github.com/graphql-hive/console/commit/a65b0bc7721c2b84417d6ba1052ffd03a34b556d)
  Thanks [@jdolle](https://github.com/jdolle)! - Add Mutation.retireAppDeployments to the public API

### Patch Changes

- [#7614](https://github.com/graphql-hive/console/pull/7614)
  [`e853916`](https://github.com/graphql-hive/console/commit/e85391651342ab23c0b19b03a93501a4f9abe2d2)
  Thanks [@mskorokhodov](https://github.com/mskorokhodov)! - Fix for schema sdl resolver to ignore
  auto fix composite schema execution in case of monolith

- [#7624](https://github.com/graphql-hive/console/pull/7624)
  [`8afab7d`](https://github.com/graphql-hive/console/commit/8afab7d822527e4eb5d20b59c33d58881afefa3f)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Fix stale app deployments query
  returning empty results for targets with >1000 deployments

- [#7628](https://github.com/graphql-hive/console/pull/7628)
  [`c15775a`](https://github.com/graphql-hive/console/commit/c15775a7dcca75d3c82f438baa721f19de79351b)
  Thanks [@jdolle](https://github.com/jdolle)! - Add created at, last used, and total docs to app
  deployment view

- [#7622](https://github.com/graphql-hive/console/pull/7622)
  [`d79d9f1`](https://github.com/graphql-hive/console/commit/d79d9f139e319734ed40c1f886531bcfa20d76b6)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix exception raised when performing an email
  invite.

- [#7653](https://github.com/graphql-hive/console/pull/7653)
  [`8857722`](https://github.com/graphql-hive/console/commit/88577222d2fa39fa37af363a80b69cafcddb4679)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Fix Clickhouse "Field value too long"
  error when querying stale app deployments on targets with 1000+ deployments

- [#7667](https://github.com/graphql-hive/console/pull/7667)
  [`0803ced`](https://github.com/graphql-hive/console/commit/0803cedb3ac585d0e84c2e251f520a5baee36aa1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update dependency `axios` to `1.13.5`, to address
  vulnerability `CVE-2026-25639`.

- [#7619](https://github.com/graphql-hive/console/pull/7619)
  [`a0e4bbf`](https://github.com/graphql-hive/console/commit/a0e4bbfa5d6109dbee01f6f15b1eaf0a7735887d)
  Thanks [@jdolle](https://github.com/jdolle)! - Remove initialChecks from schema proposal creation
  mutation; Show proposal schema check updates in a dialog box

- [#7592](https://github.com/graphql-hive/console/pull/7592)
  [`6709e71`](https://github.com/graphql-hive/console/commit/6709e719c14ca097761f9eb1f81115c69dc369d4)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - added light mode to console

## 9.3.0

### Minor Changes

- [#7540](https://github.com/graphql-hive/console/pull/7540)
  [`903c7f5`](https://github.com/graphql-hive/console/commit/903c7f57c89a85bc2068216292df2ac0c329212b)
  Thanks [@rickbijkerk](https://github.com/rickbijkerk)! - Improve type sorting within the schema
  explorer. The changes are now sorted by relevance.

  - Exact matches appear first (e.g., `Product` when searching `product`)
  - Prefix matches appear second (e.g., `ProductInfo` when searching `prod`)
  - Contains matches appear last, sorted alphabetically

- [#7432](https://github.com/graphql-hive/console/pull/7432)
  [`f8e49ae`](https://github.com/graphql-hive/console/commit/f8e49ae53f743a50e104fba216bd4545fb4abdd6)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add app deployment retirement
  protection settings. When enabled, prevents retiring app deployments that were recently created or
  are still actively used, based on configurable inactivity period, creation age, and traffic
  thresholds.

- [#7584](https://github.com/graphql-hive/console/pull/7584)
  [`0f0430f`](https://github.com/graphql-hive/console/commit/0f0430f4f56c5508c9bea737d10de14e1a08d5af)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Enable automatic retrieval of schema changes by
  comparing with the latest composable version. This has already been the default for new projects
  created after April 2024.

  Federation and schema stitching projects can now publish service schemas to the registry even if
  those schemas would break composition. This has also been the default behavior for new projects
  created after April 2024.

  To ensure every version publishd to the schema registry is composable, we recommend to first check
  the schema against the registry **before** publishing.

- [#7603](https://github.com/graphql-hive/console/pull/7603)
  [`545349f`](https://github.com/graphql-hive/console/commit/545349fbc76f55c4b79fcb4260ad2fc0453275b7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Enable email verification against SSO accounts.

  This is a prior step to ensure that all SSO account owners also own their email, before
  introducing an email-based account linking system.

### Patch Changes

- [#7612](https://github.com/graphql-hive/console/pull/7612)
  [`1272c1c`](https://github.com/graphql-hive/console/commit/1272c1ca32e6f09659f817301e965840aad621e2)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerabilities in dependencies
  (CVE-2026-25224, CVE-2026-25223).

- [#7552](https://github.com/graphql-hive/console/pull/7552)
  [`3f1743c`](https://github.com/graphql-hive/console/commit/3f1743c76187adfa9f2a60afbdc8c3b632aaf711)
  Thanks [@jdolle](https://github.com/jdolle)! - Render directive diff on schema definitions

## 9.2.0

### Minor Changes

- [#7531](https://github.com/graphql-hive/console/pull/7531)
  [`f4eb13f`](https://github.com/graphql-hive/console/commit/f4eb13f9edad1bc9f4d98afae55a006094b8a030)
  Thanks [@jdolle](https://github.com/jdolle)! - Store schema proposal changes on a separate column
  in the schema check; update graphql inspector

### Patch Changes

- [#7491](https://github.com/graphql-hive/console/pull/7491)
  [`c4776b8`](https://github.com/graphql-hive/console/commit/c4776b80abf7e71f48d82a8988bc6055d14706b0)
  Thanks [@jdolle](https://github.com/jdolle)! - Support repeat directives in schema proposal diff
  renderer. This uses an index based approach to identify and render differences in the list of
  directives used.

- [#7543](https://github.com/graphql-hive/console/pull/7543)
  [`cf4ff09`](https://github.com/graphql-hive/console/commit/cf4ff0923a85c02a85631e7c2edffd9bb2f83526)
  Thanks [@jdolle](https://github.com/jdolle)! - Disable project and target cards during loading

- [#7538](https://github.com/graphql-hive/console/pull/7538)
  [`5a07b98`](https://github.com/graphql-hive/console/commit/5a07b982b1f1617138b9b0e21b12447c8b3ad86b)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix schema check approval dropdown submit button
  style

## 9.1.0

### Minor Changes

- [#7388](https://github.com/graphql-hive/console/pull/7388)
  [`53f9d5e`](https://github.com/graphql-hive/console/commit/53f9d5e30337b10ea0fdc954b56687d495556c77)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Show affected app deployments for
  breaking schema changes. When a schema check detects breaking changes, it now shows which active
  app deployments would be affected, including the specific operations within each deployment that
  use the affected schema coordinates.

## 9.0.0

### Major Changes

- [#7383](https://github.com/graphql-hive/console/pull/7383)
  [`ec77725`](https://github.com/graphql-hive/console/commit/ec77725ca16db22e238b4f3ba3d9c881ffb0cd62)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add a new `workflows` service. This service
  consolidates and replaces the `emails` and `webhooks` services, using a Postgres-backed persistent
  queue for improved stability and reliability.

  If you are running a self-hosted setup the following docker compose changes are required:

  ```diff
  services:

  +  workflows:
  +    image: '${DOCKER_REGISTRY}workflows${DOCKER_TAG}'
  +    networks:
  +      - 'stack'
  +    depends_on:
  +      db:
  +        condition: service_healthy
  +    environment:
  +      NODE_ENV: production
  +      PORT: 3014
  +      POSTGRES_HOST: db
  +      POSTGRES_PORT: 5432
  +      POSTGRES_DB: '${POSTGRES_DB}'
  +      POSTGRES_USER: '${POSTGRES_USER}'
  +      POSTGRES_PASSWORD: '${POSTGRES_PASSWORD}'
  +      EMAIL_FROM: no-reply@graphql-hive.com
  +      EMAIL_PROVIDER: sendmail
  +      LOG_LEVEL: '${LOG_LEVEL:-debug}'
  +      SENTRY: '${SENTRY:-0}'
  +      SENTRY_DSN: '${SENTRY_DSN:-}'
  +      PROMETHEUS_METRICS: '${PROMETHEUS_METRICS:-}'
  +      LOG_JSON: '1'
  -  emails:
  -    ...
  -  webhooks:
  -    ...
  ```

  For different setups, we recommend using this as a reference.

  **Note:** The workflows service will attempt to run postgres migrations for seeding the required
  database tables within the `graphile_worker` namespace. Please make sure the database user has
  sufficient permissions. For more information please refer to the
  [Graphile Worker documentation](https://worker.graphile.org/).

- [#7492](https://github.com/graphql-hive/console/pull/7492)
  [`954e9f3`](https://github.com/graphql-hive/console/commit/954e9f3c37c8518a083b330caa160931779d9a84)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Bump Node.js version to `v24.13.0`.

### Minor Changes

- [#7377](https://github.com/graphql-hive/console/pull/7377)
  [`8549f22`](https://github.com/graphql-hive/console/commit/8549f222405a08dec4b2974a28414415c0859cf9)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add `activeAppDeployments` GraphQL
  query to find app deployments based on usage criteria.

  New filter options:

  - `lastUsedBefore`: Find stale deployments that were used but not recently (OR with
    neverUsedAndCreatedBefore)
  - `neverUsedAndCreatedBefore`: Find old deployments that have never been used (OR with
    lastUsedBefore)
  - `name`: Filter by app deployment name (case-insensitive partial match, AND with date filters)

  Also adds `createdAt` field to the `AppDeployment` type.

  See
  [Finding Stale App Deployments](https://the-guild.dev/graphql/hive/docs/schema-registry/app-deployments#finding-stale-app-deployments)
  for more details.

### Patch Changes

- [#7475](https://github.com/graphql-hive/console/pull/7475)
  [`e022bb4`](https://github.com/graphql-hive/console/commit/e022bb4805afcc4583db26b16ffd03822d22258f)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix org owner not being able to select a new
  billing plan after downgrading.

- [#7478](https://github.com/graphql-hive/console/pull/7478)
  [`8e2e40d`](https://github.com/graphql-hive/console/commit/8e2e40dcf02664b5fe17ed1c7ffbff9e0ec9ffe0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve error message when schema composition
  exceeds the memory consumption limits.

- [#7485](https://github.com/graphql-hive/console/pull/7485)
  [`e3006e2`](https://github.com/graphql-hive/console/commit/e3006e22bbe38e673c27b94b080be5f57f3d095d)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fixes a bug in Federation composition
  and validation where an error was incorrectly reported for interfaces implementing another
  interface with a `@key`. The validation now correctly applies only to object types implementing
  the interface.

- [#7508](https://github.com/graphql-hive/console/pull/7508)
  [`8e111ac`](https://github.com/graphql-hive/console/commit/8e111ac4285c5b13196d11908b5afee512dc0e9b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix federation composition access validation on
  union members when selecting `__typename` in `@requires` directives.

  The `@requires` directive validation rule (`AuthOnRequiresRule`) was not checking authorization
  requirements for `__typename` selections on union types. When `__typename` on a union type was
  selected, code would throw an unexpected error.

## 8.14.1

### Patch Changes

- [#7477](https://github.com/graphql-hive/console/pull/7477)
  [`b90f215`](https://github.com/graphql-hive/console/commit/b90f215213996ac755caca853a91816350936303)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Show correct error message for insufficient GitHub
  App installation permissions when attempting to create a check run as part of a schema check.

- [#7459](https://github.com/graphql-hive/console/pull/7459)
  [`0ce9c82`](https://github.com/graphql-hive/console/commit/0ce9c82b810fef311f3856bb90b2e2a1823a7101)
  Thanks [@jdolle](https://github.com/jdolle)! - Set usageEstimation year validation range at
  runtime to avoid issues during the new year. This fixes an issue where the organization settings
  usage data was not loading for January until the service was deployed again.

- [#7451](https://github.com/graphql-hive/console/pull/7451)
  [`bd4e36d`](https://github.com/graphql-hive/console/commit/bd4e36d4860c2ae0c2671fa713d0f445b47447d4)
  Thanks [@jdolle](https://github.com/jdolle)! - Show diff on proposals editor

## 8.14.0

### Minor Changes

- [#6836](https://github.com/graphql-hive/console/pull/6836)
  [`128ce1b`](https://github.com/graphql-hive/console/commit/128ce1bdf26c07f7bfe7a598951562df6471bb73)
  Thanks [@jdolle](https://github.com/jdolle)! - adjust change capture and resolvers to optionally
  provide a full list or the simplified list of changes

- [#7423](https://github.com/graphql-hive/console/pull/7423)
  [`a71cd2b`](https://github.com/graphql-hive/console/commit/a71cd2bbb9c35203aa6b25bbb3dbef7c4b0c8b68)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Bump minio docker images to latest stable version.

- [#6836](https://github.com/graphql-hive/console/pull/6836)
  [`128ce1b`](https://github.com/graphql-hive/console/commit/128ce1bdf26c07f7bfe7a598951562df6471bb73)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

- [#7418](https://github.com/graphql-hive/console/pull/7418)
  [`444c0cc`](https://github.com/graphql-hive/console/commit/444c0cc10dfb90f697aa79b66d4f46da3000913f)
  Thanks [@jdolle](https://github.com/jdolle)! - Add usage info to public API. This usage data can
  be requested using the operation:

  ```
  query OrgUsage($orgReference: OrganizationReferenceInput!, $year: Int!, $month: Int!) {
      organization(reference: $orgReference) {
          isMonthlyOperationsLimitExceeded
          monthlyOperationsLimit
          usageRetentionInDays
          usageEstimation(input: { year: $year , month: $month }) {
              operations
          }
      }
  }
  ```

- [#7441](https://github.com/graphql-hive/console/pull/7441)
  [`0d35406`](https://github.com/graphql-hive/console/commit/0d354066b68d4cc414b5ec18f51bd6887c4cbd93)
  Thanks [@XiNiHa](https://github.com/XiNiHa)! - Add support for specifying additional OIDC scopes

## 8.13.0

### Minor Changes

- [#7303](https://github.com/graphql-hive/console/pull/7303)
  [`840bc08`](https://github.com/graphql-hive/console/commit/840bc08236dfd635d720566360b176e1cc59ce70)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add configurable data retention TTL
  for self-hosted Hive instances. Self-hosted users can now configure retention periods via
  environment variables instead of hardcoded values.

  New environment variables:

  - `CLICKHOUSE_TTL_TABLES` - Retention for ClickHouse mergetree tables (Default: 1 YEAR)
  - `CLICKHOUSE_TTL_DAILY_MV_TABLES` - Retention for daily materialized view tables (Default: 1
    YEAR)
  - `CLICKHOUSE_TTL_HOURLY_MV_TABLES` - Retention for hourly materialized view tables (Default: 30
    DAYS)
  - `CLICKHOUSE_TTL_MINUTELY_MV_TABLES` - Retention for minutely materialized view tables (Default:
    24 HOURS)

  Supports both numeric days (e.g., `365`) and ClickHouse interval syntax (e.g., `"1 YEAR"`,
  `"30 DAY"`, `"24 HOUR"`).

  The retention update runs automatically if any retention environment variable is set.

- [#7333](https://github.com/graphql-hive/console/pull/7333)
  [`4aa5247`](https://github.com/graphql-hive/console/commit/4aa524779c257602864f582fc3eb02b02c86d29a)
  Thanks [@alexdaima](https://github.com/alexdaima)! - Update Redis client to support connecting to
  IPv6 networks.

- [#7400](https://github.com/graphql-hive/console/pull/7400)
  [`c396566`](https://github.com/graphql-hive/console/commit/c396566b077e4b6ce26e0fab2004fa223e7dfc6f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add support for retrieving CDN artifacts by version
  ID.

  New CDN endpoints allow fetching schema artifacts for a specific version:

  - `/artifacts/v1/:targetId/version/:versionId/:artifactType`
  - `/artifacts/v1/:targetId/version/:versionId/contracts/:contractName/:artifactType`

  Artifacts are now written to both the latest path and a versioned path during schema publish,
  enabling retrieval of historical versions.

  CDN artifact responses now include the `x-hive-schema-version-id` header, providing the version ID
  of the schema being served.

### Patch Changes

- [#7381](https://github.com/graphql-hive/console/pull/7381)
  [`415a9c1`](https://github.com/graphql-hive/console/commit/415a9c19d27e825c55bd9b492f8316624b4d6cf7)
  Thanks [@jdolle](https://github.com/jdolle)! - Hide unnecessary elements from header when screen
  is narrow

- [#7352](https://github.com/graphql-hive/console/pull/7352)
  [`727e525`](https://github.com/graphql-hive/console/commit/727e525abbd26dce638278ee26e0311f725571e1)
  Thanks [@jdolle](https://github.com/jdolle)! - Correctly check the global environment feature flag
  in for app deployments and fix app deployment pagination

- [#7402](https://github.com/graphql-hive/console/pull/7402)
  [`4183e55`](https://github.com/graphql-hive/console/commit/4183e5519851167c29dcc73f738108fad05cdce7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve native federation schema composition.
  Prevent subgraph-specific federation types and scalars being re-declared within the subgraph
  leaking into the supergraph.

- [#7391](https://github.com/graphql-hive/console/pull/7391)
  [`d027f99`](https://github.com/graphql-hive/console/commit/d027f99321aa338209b42a89133a112926a22f7f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix exception raised by server when updating user
  profile information.

- [#7389](https://github.com/graphql-hive/console/pull/7389)
  [`a9a3e5f`](https://github.com/graphql-hive/console/commit/a9a3e5f9f1e942302bd6ce884f9afa011f2a7a96)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Do not swallow 4XX HTTP errors as 500 internal
  server errors when sentry error reporting is enabled.

  Send the same predictable error responses with and without the sentry plugin enabled.

## 8.12.1

### Patch Changes

- [#7350](https://github.com/graphql-hive/console/pull/7350)
  [`46ccf46`](https://github.com/graphql-hive/console/commit/46ccf4611eefd36ee20ec8598730d5f8b05c743a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix invalid materialized view definition causing
  failing ClickHouse migrations

- [#7349](https://github.com/graphql-hive/console/pull/7349)
  [`cf91128`](https://github.com/graphql-hive/console/commit/cf91128bc47b1d3980f5fdc6a05603503274d8ee)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Stricter CORS assessment for requests sending a
  Origin header.

## 8.12.0

### Minor Changes

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

### Patch Changes

- [#7328](https://github.com/graphql-hive/console/pull/7328)
  [`c024ea7`](https://github.com/graphql-hive/console/commit/c024ea7666ee96517b34286d8da35ef20ed89044)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Expose `Project.createdAt` field via
  the public GraphQL API.

## 8.11.0

### Minor Changes

- [#7267](https://github.com/graphql-hive/console/pull/7267)
  [`114cd80`](https://github.com/graphql-hive/console/commit/114cd80a8e419d6ff631631fee28a9922a7b9e5a)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

## 8.10.0

### Minor Changes

- [#7306](https://github.com/graphql-hive/console/pull/7306)
  [`29de664`](https://github.com/graphql-hive/console/commit/29de664960f3bcbadd3672645ed7fff5126aa012)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Updated federation-composition to
  v0.21.0

  - **Enhanced auth directive validation**: The federation-composition now enforces correct
    placement of auth directives (`@authenticated`, `@requiresScopes`, `@policy`) by rejecting
    attempts to place them on interfaces, interface fields, or interface objects with the new
    `AUTH_REQUIREMENTS_APPLIED_ON_INTERFACE` validation rule.
  - **Transitive auth requirements checking**: Added a new validation rule that ensures fields using
    `@requires` specify at least the auth requirements of the fields they select. If a field doesn't
    carry forward required auth directives, composition fails with a
    `MISSING_TRANSITIVE_AUTH_REQUIREMENTS` error.
  - **Auth requirements inheritance**: Interface types and fields now properly inherit
    `@authenticated`, `@requiresScopes`, and `@policy` directives from the object types that
    implement them.
  - **`@cost` directive restrictions**: The `@cost` directive can no longer be placed on interface
    types, their fields, or field arguments. Invalid placements now result in composition errors
    instead of being silently accepted.
  - **Improved `@listSize` validation**: The directive now validates that `sizedFields` point to
    actual list fields rather than integer counters. Additionally, `slicingArguments` validation has
    been added to ensure only arguments that exist in all subgraphs are retained.
  - **Fixed `EXTERNAL_MISSING_ON_BASE` rule**: Resolved false positives when handling
    `@interfaceObject` corner-cases, particularly for `@external` fields on object types provided by
    interface objects.

- [#7291](https://github.com/graphql-hive/console/pull/7291)
  [`802315e`](https://github.com/graphql-hive/console/commit/802315eb849c4933b5e5292c9dcc5245df3aad8b)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - eliminate clickhouse query timeouts
  and improve read times of large amounts of traces in dashboard

## 8.9.0

### Minor Changes

- [#7281](https://github.com/graphql-hive/console/pull/7281)
  [`791c025`](https://github.com/graphql-hive/console/commit/791c0252a0933d0f5c933eef9053227d7f00c87e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce rate limiting for email sign up, sign in
  and password rest. The IP value to use for the rate limiting can be specified via the
  `SUPERTOKENS_RATE_LIMIT_IP_HEADER_NAME` environment variable. By default the `CF-Connecting-IP`
  header is being used.

- [#7292](https://github.com/graphql-hive/console/pull/7292)
  [`9c19215`](https://github.com/graphql-hive/console/commit/9c19215cabd37ee00c9bbd0115e242b7a315e7db)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add AWS Lambda CDN Artifact Handler.

### Patch Changes

- [#7304](https://github.com/graphql-hive/console/pull/7304)
  [`172ee83`](https://github.com/graphql-hive/console/commit/172ee83a0ee69f75107525a2d6d3cb1cfadd6530)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Upgrade OpenTelemetry Collector to
  v0.140.0 (from v0.122.0) and Go to 1.25 (from 1.23). This includes updating all collector
  component dependencies and adapting the hive auth extension for API compatibility changes.

- [#7295](https://github.com/graphql-hive/console/pull/7295)
  [`76c700f`](https://github.com/graphql-hive/console/commit/76c700f322d8ec81a4fcea0333283427633f8412)
  Thanks [@jonathanawesome](https://github.com/jonathanawesome)! - Fixes a UI bug in
  MembershipInvitation modal when there are many projects/targets/services.

## 8.8.0

### Minor Changes

- [#7252](https://github.com/graphql-hive/console/pull/7252)
  [`717b5aa`](https://github.com/graphql-hive/console/commit/717b5aa6e839c0e73b85322908331768f0cdcc57)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support selecting resources when inviting a user
  via email.

- [#7252](https://github.com/graphql-hive/console/pull/7252)
  [`717b5aa`](https://github.com/graphql-hive/console/commit/717b5aa6e839c0e73b85322908331768f0cdcc57)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support assigning default resources for new OIDC
  members.

## 8.7.1

### Patch Changes

- [#7203](https://github.com/graphql-hive/console/pull/7203)
  [`a7fed52`](https://github.com/graphql-hive/console/commit/a7fed52e17c8e2f1c38e93523e302a27b4d30f1b)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - handle escaped single-quoted strings
  in schema changes

## 8.7.0

### Minor Changes

- [#7206](https://github.com/graphql-hive/console/pull/7206)
  [`01963a0`](https://github.com/graphql-hive/console/commit/01963a089968f6d956c9dbc7d090dd6dc907c305)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce personal access tokens (PAT) and project
  scoped access tokens.

## 8.6.0

### Minor Changes

- [#7202](https://github.com/graphql-hive/console/pull/7202)
  [`0885253`](https://github.com/graphql-hive/console/commit/0885253d14be7e3e0a973c863e45b115ba84f6e8)
  Thanks [@noghartt](https://github.com/noghartt)! - Add envs for KV namespace on Cloudflare CDN
  worker

### Patch Changes

- [#7193](https://github.com/graphql-hive/console/pull/7193)
  [`543de17`](https://github.com/graphql-hive/console/commit/543de174f5cb8caa46b8e833d13e1831c7ffbfa9)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - `schema:check --forceSafe` now
  properly approves breaking schema changes in Hive (requires write permission registry token)

- [#7234](https://github.com/graphql-hive/console/pull/7234)
  [`ef46bbf`](https://github.com/graphql-hive/console/commit/ef46bbfeb82f866ddb200dd2cf745176f114c601)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve checks for assigning member roles to avoid
  assigning roles not existing in the organization.

## 8.5.2

### Patch Changes

- [#7185](https://github.com/graphql-hive/console/pull/7185)
  [`7457e4d`](https://github.com/graphql-hive/console/commit/7457e4de75c51a218493b6c7ea5b0e3823d99f6a)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Fix schema check approval to properly
  reject checks with policy errors and return descriptive error message instead of generic error

## 8.5.1

### Patch Changes

- [#7177](https://github.com/graphql-hive/console/pull/7177)
  [`1f7f195`](https://github.com/graphql-hive/console/commit/1f7f1951b2b1ef76d0853a6588e39458e5e1a982)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix issue with native federation public SDL
  generation around inaccessible interfaces.

  **Example supergraph:**

  ```
  schema
    @link(
      url: "https://specs.apollo.dev/federation/v2.3"
      import: ["@inaccessible"]
    ) {
    query: Query
  }

  type Query {
    user: User!
  }

  interface Node @inaccessible {
    id: ID!
  }

  type User implements Node {
    id: ID!
  }
  ```

  **Public Schema SDL output:**

  ```diff
    type Query {
      user: User!
    }

  - type User implements Node {
  + type User {
      id: ID!
    }
  ```

## 8.5.0

### Minor Changes

- [#7155](https://github.com/graphql-hive/console/pull/7155)
  [`caebbe0`](https://github.com/graphql-hive/console/commit/caebbe093a997022691276e0dc67ce9ab8589112)
  Thanks [@jdolle](https://github.com/jdolle)! - add schemaVersionByCommit; update docs and cli; fix
  webhook commit reference

### Patch Changes

- [#7124](https://github.com/graphql-hive/console/pull/7124)
  [`0e44587`](https://github.com/graphql-hive/console/commit/0e4458772196ad490b682bf9a87971d5179c3985)
  Thanks [@jdolle](https://github.com/jdolle)! - get latest log in version by commit and add version
  details to history page

## 8.4.1

### Patch Changes

- [#7123](https://github.com/graphql-hive/console/pull/7123)
  [`7b636c6`](https://github.com/graphql-hive/console/commit/7b636c6691ea47691b02b41433d2bfc05970b81e)
  Thanks [@jdolle](https://github.com/jdolle)! - show overflowed client and versions on insights

- [#7119](https://github.com/graphql-hive/console/pull/7119)
  [`f2e70bb`](https://github.com/graphql-hive/console/commit/f2e70bb0aa477a5cc039e26ea87648a6130e4501)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix issue where wrong subgraph is shown as the
  owner of a schema coordinate/field.

## 8.4.0

### Minor Changes

- [#7085](https://github.com/graphql-hive/console/pull/7085)
  [`e5aa9bd`](https://github.com/graphql-hive/console/commit/e5aa9bde3e8e2c4fad87bfa26e2841ce92629bb2)
  Thanks [@egoodwinx](https://github.com/egoodwinx)! - add user message when stripe is blocked

### Patch Changes

- [#7090](https://github.com/graphql-hive/console/pull/7090)
  [`0d1cf80`](https://github.com/graphql-hive/console/commit/0d1cf80f2894c0e01bb8df4cd3aee31c23b3d975)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Further improve the performance of loading the
  deprecated schema view for large schemas.

- [#7079](https://github.com/graphql-hive/console/pull/7079)
  [`cbbd5e5`](https://github.com/graphql-hive/console/commit/cbbd5e52b6b4f538b33e213ff393766c523be08c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix dashboard background using different shades of
  black.

## 8.3.0

### Minor Changes

- [#7030](https://github.com/graphql-hive/console/pull/7030)
  [`12c5665`](https://github.com/graphql-hive/console/commit/12c5665a43396388516c31d22ff2f3c719007447)
  Thanks [@jdolle](https://github.com/jdolle)! - add operation counts by selected client to insights
  filter

- [#7060](https://github.com/graphql-hive/console/pull/7060)
  [`93967de`](https://github.com/graphql-hive/console/commit/93967de720fb4f74780d6d5cf760d54eadba8de4)
  Thanks [@jdolle](https://github.com/jdolle)! - add search to app deployment version by operation
  name

- [#7035](https://github.com/graphql-hive/console/pull/7035)
  [`88ce5d3`](https://github.com/graphql-hive/console/commit/88ce5d3587b880ccba58bd9736042a8a8f1ef81f)
  Thanks [@jdolle](https://github.com/jdolle)! - Add selected counts to insights client filter

- [#7050](https://github.com/graphql-hive/console/pull/7050)
  [`d1ec149`](https://github.com/graphql-hive/console/commit/d1ec149b9e0178f1ead24a6f79d9c9848f72a762)
  Thanks [@XiNiHa](https://github.com/XiNiHa)! - Refine schema composition settings UI

### Patch Changes

- [#7033](https://github.com/graphql-hive/console/pull/7033)
  [`2449790`](https://github.com/graphql-hive/console/commit/2449790e24b807939adf72de13787f7c48719e1b)
  Thanks [@XiNiHa](https://github.com/XiNiHa)! - Stay in the opened page when switching between
  targets

- [#7030](https://github.com/graphql-hive/console/pull/7030)
  [`12c5665`](https://github.com/graphql-hive/console/commit/12c5665a43396388516c31d22ff2f3c719007447)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix paginated operations list filtering if there
  are many operations by passing a list of operation IDs to filter on

- [#7067](https://github.com/graphql-hive/console/pull/7067)
  [`7a39b32`](https://github.com/graphql-hive/console/commit/7a39b323d9167664a6e499dce3bb6f40caaf2e52)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix input cursor reset for org and project

- [#7045](https://github.com/graphql-hive/console/pull/7045)
  [`0f26e42`](https://github.com/graphql-hive/console/commit/0f26e4253de96b3107972993410dc32a659dbcc2)
  Thanks [@jdolle](https://github.com/jdolle)! - Adjust token creation ui to make toggling
  all/granular and services/apps more intuitive

- [#7066](https://github.com/graphql-hive/console/pull/7066)
  [`58658a4`](https://github.com/graphql-hive/console/commit/58658a49b5ef23f2d884c4a6966e4dca30b1a1b1)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix first schema check landing width; fix
  flickering sidenav on schema check loading"

- [#7061](https://github.com/graphql-hive/console/pull/7061)
  [`5cac244`](https://github.com/graphql-hive/console/commit/5cac2441fd475aff2d38faac5ebf51a7e08baf58)
  Thanks [@jdolle](https://github.com/jdolle)! - fix explorer field input cursor reset

- [#7071](https://github.com/graphql-hive/console/pull/7071)
  [`1b7c7b5`](https://github.com/graphql-hive/console/commit/1b7c7b5506eca9e78fee1a4fef150562e73873c5)
  Thanks [@jdolle](https://github.com/jdolle)! - fix error printing in logs

- [#7074](https://github.com/graphql-hive/console/pull/7074)
  [`8eb9e14`](https://github.com/graphql-hive/console/commit/8eb9e144b7e9a452b2d596776d75d136540207ff)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Prevent potential resource exhaustion in the
  deprecated schema explorer for large schemas.

## 8.2.1

### Patch Changes

- [#6935](https://github.com/graphql-hive/console/pull/6935)
  [`261daf8`](https://github.com/graphql-hive/console/commit/261daf81c384dc992608431e388836b7dde54336)
  Thanks [@jdolle](https://github.com/jdolle)! - AppDeployment permissions granted to all if none
  selected by default in access token UI. Fix app deployments feature flag check

- [#7004](https://github.com/graphql-hive/console/pull/7004)
  [`07a99f0`](https://github.com/graphql-hive/console/commit/07a99f0f4cd21edae5da734893175e1675c23173)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve usability when creating a registry access
  token.

## 8.2.0

### Minor Changes

- [#6951](https://github.com/graphql-hive/console/pull/6951)
  [`f567fbb`](https://github.com/graphql-hive/console/commit/f567fbbf49124e0f7ce54fdf8104acd422c543bb)
  Thanks [@martyganz](https://github.com/martyganz)! - Add `SchemaVersion.unusedSchema` and
  `SchemaVersion.deprecatedSchema` to the public API schema.

- [#6960](https://github.com/graphql-hive/console/pull/6960)
  [`e57b6c0`](https://github.com/graphql-hive/console/commit/e57b6c01987e6be9013923ffe760b0fa4fe390a1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Return all users by default if no `first` value is
  provided for the `Organization.members` field.

### Patch Changes

- [#6963](https://github.com/graphql-hive/console/pull/6963)
  [`91e830b`](https://github.com/graphql-hive/console/commit/91e830be6cf9fca238375616a8b79d637ae89e10)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve styling of unused schema parts.

- [#6961](https://github.com/graphql-hive/console/pull/6961)
  [`a66013d`](https://github.com/graphql-hive/console/commit/a66013d5eaa436c8c8106c6c29b546b76b5e50bc)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Prevent editing the base schema showing up for
  federation projects.

## 8.1.2

### Patch Changes

- [#6924](https://github.com/graphql-hive/console/pull/6924)
  [`d6cf026`](https://github.com/graphql-hive/console/commit/d6cf02663783076a3ab25d295d1c7a6eb7b2c711)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix selecting "All" app deployments in target when
  creating an access token

- [#6909](https://github.com/graphql-hive/console/pull/6909)
  [`d5218b8`](https://github.com/graphql-hive/console/commit/d5218b8d728c37628ee4a83a89e9bc922af84804)
  Thanks [@jdolle](https://github.com/jdolle)! - Correctly trim operation name on insights and add
  popover title

## 8.1.1

### Patch Changes

- [#6867](https://github.com/graphql-hive/console/pull/6867)
  [`be0d710`](https://github.com/graphql-hive/console/commit/be0d71025b4d1bee06b6059f31bd5039e9709b5d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Only show the "edit preflight script" button in the
  laboratory when the users has permissions to edit it.

- [#6881](https://github.com/graphql-hive/console/pull/6881)
  [`f8a1350`](https://github.com/graphql-hive/console/commit/f8a13506f747b297f6c7bfd295fe13af89153380)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `project:create` permission to the acccess
  token permission selection screen.

- [#6875](https://github.com/graphql-hive/console/pull/6875)
  [`73864f2`](https://github.com/graphql-hive/console/commit/73864f2b954387406c6d7f3a205d7ee38663e6a4)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix default organization resolution and prevent
  missing permissions error.

- [#6879](https://github.com/graphql-hive/console/pull/6879)
  [`3779184`](https://github.com/graphql-hive/console/commit/3779184a440743f04bd18943651da7b77f7a43c0)
  Thanks [@egoodwinx](https://github.com/egoodwinx)! - Fix schema version browser history
  navigation.

## 8.1.0

### Minor Changes

- [#6843](https://github.com/graphql-hive/console/pull/6843)
  [`d175fba`](https://github.com/graphql-hive/console/commit/d175fba8f17f36ce3205e14032eee89222f85f08)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Make `Target.graphqlEndpointUrl` available
  in public GraphQL API

### Patch Changes

- [#6829](https://github.com/graphql-hive/console/pull/6829)
  [`e81cea8`](https://github.com/graphql-hive/console/commit/e81cea889c26b3ee0453defbfec5a78ba24e90a6)
  Thanks [@jdolle](https://github.com/jdolle)! - Add pg index for getSchemaVersionByActionId to
  improve lookup performance

- [#6850](https://github.com/graphql-hive/console/pull/6850)
  [`faa22bb`](https://github.com/graphql-hive/console/commit/faa22bbe662f0df7cca3b9045a22d495897714ee)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix issue where contract composition marks types
  occuring in multiple subgraphs as `@inaccessible` despite being used within the public API schema.

- [#6845](https://github.com/graphql-hive/console/pull/6845)
  [`114e7bc`](https://github.com/graphql-hive/console/commit/114e7bcf6860030b668fb1af7faed3650c278a51)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update `@theguild/federation-composition` to
  `0.19.0`

  Increases federation composition compatibility.

  - Fix errors raised by `@requires` with union field selection set
  - Fix incorrectly raised `IMPLEMENTED_BY_INACCESSIBLE` error for inaccessible object fields where
    the object type is inaccessible.
  - Add support for `@provides` fragment selection sets on union type fields.
  - Fix issue where the satisfiability check raised an exception for fields that share different
    object type and interface definitions across subgraphs.
  - Fix issue where scalar type marked with `@inaccessible` does not fail the composition if all
    usages are not marked with `@inaccessible`.
  - Support composing executable directives from subgraphs into the supergraph

- [#6862](https://github.com/graphql-hive/console/pull/6862)
  [`6cf18b9`](https://github.com/graphql-hive/console/commit/6cf18b9d9c10dfcbd95d148571dc305eb5c71b4c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Show whether a breaking change is safe based on
  usage within the GitHub check-run summary.

- [#6864](https://github.com/graphql-hive/console/pull/6864)
  [`35a69a1`](https://github.com/graphql-hive/console/commit/35a69a1064319c74b9b76a521698ce1260383f08)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Validate schema stitching output sdl. Previously,
  this caused invalid SDL to be promoted as the latest valid schema version.

## 8.0.0

### Major Changes

- [#6810](https://github.com/graphql-hive/console/pull/6810)
  [`ae65069`](https://github.com/graphql-hive/console/commit/ae65069da79f3863ddfe6c4da80826af2b8c4b0a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add mutation fields for managing schema contracts
  to the public api schema.

  - `Mutation.createContract`
  - `Mutation.disableContract`

  **BREAKING CHANGE**: This renames and changes the types for existing types within the private
  GraphQL schema.

- [#6722](https://github.com/graphql-hive/console/pull/6722)
  [`aab6e7c`](https://github.com/graphql-hive/console/commit/aab6e7c2cfbd8453e0062362fc10244da98d57d1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add mutation fields for managing users to the
  public api schema.

  - `Mutation.assignMemberRole`
  - `Mutation.createMemberRole`
  - `Mutation.deleteMemberRole`
  - `Mutation.deleteOrganizationInvitation`
  - `Mutation.inviteToOrganizationByEmail`
  - `Mutation.updateMemberRole`

  **BREAKING CHANGE**: This renames and changes the types for existing types within the private
  GraphQL schema.

- [#6786](https://github.com/graphql-hive/console/pull/6786)
  [`20bfc4c`](https://github.com/graphql-hive/console/commit/20bfc4c052367efd9bc4d8e9a35e0a72aee2c95b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add mutation fields for managing projects to the
  public api schema.

  - `Mutation.createProject`
  - `Mutation.updateProjectSlug`
  - `Mutation.deleteProject`

  **BREAKING CHANGE**: This renames and changes the types for existing types within the private
  GraphQL schema.

- [#6795](https://github.com/graphql-hive/console/pull/6795)
  [`3552957`](https://github.com/graphql-hive/console/commit/3552957eeb2c7bf2bf74d912f58b32e56d6bc69f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add fields for querying usage datato the public api
  schema.

  - `Target.schemaCoordinateStats`
  - `Target.clientStats`
  - `Target.operationsStats`

  **BREAKING CHANGE**: This renames and changes the types for existing types within the private
  GraphQL schema.

### Minor Changes

- [#6764](https://github.com/graphql-hive/console/pull/6764)
  [`bbd5643`](https://github.com/graphql-hive/console/commit/bbd5643924eb2b32511e96a03a3a5a978a66adee)
  Thanks [@jdolle](https://github.com/jdolle)! - Track provided operation arguments/inputs and use
  them to determine conditional breaking changes; Fix null to non-null argument breaking change edge
  case"

### Patch Changes

- [#6780](https://github.com/graphql-hive/console/pull/6780)
  [`6c0b6f3`](https://github.com/graphql-hive/console/commit/6c0b6f3051d8ee73307094d124a32496f196a547)
  Thanks [@jdolle](https://github.com/jdolle)! - Add pg indexes to help with org delete

- [#6814](https://github.com/graphql-hive/console/pull/6814)
  [`7574cce`](https://github.com/graphql-hive/console/commit/7574cce6d6155628ee8303ad4e7782af4f8a303d)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix random infinite loop on schema checks page

- [#6791](https://github.com/graphql-hive/console/pull/6791)
  [`6f43b3e`](https://github.com/graphql-hive/console/commit/6f43b3e753ab16e28a11d14ee5afef96be7e1c0d)
  Thanks [@jdolle](https://github.com/jdolle)! - Remove redundant pg indices

- [#6792](https://github.com/graphql-hive/console/pull/6792)
  [`54acc25`](https://github.com/graphql-hive/console/commit/54acc25e156188c22b7aaeb71ae9cce59cc94ba8)
  Thanks [@jdolle](https://github.com/jdolle)! - Adjust contract to target foreign key reference to
  cascade delete

- [#6793](https://github.com/graphql-hive/console/pull/6793)
  [`81df783`](https://github.com/graphql-hive/console/commit/81df78373a0c8a96540740c2a8e3efd9a513640e)
  Thanks [@jdolle](https://github.com/jdolle)! - Adjust date range selector ui

## 7.0.2

### Patch Changes

- [`8477e2b`](https://github.com/graphql-hive/console/commit/8477e2b7f07bc2260582b5565cee1b139f7a9e97)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Fix release notes

## 7.0.1

### Patch Changes

- [#6784](https://github.com/graphql-hive/console/pull/6784)
  [`549ca54`](https://github.com/graphql-hive/console/commit/549ca54909ad7f62892900d737d8ea1fa01d498b)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Minor bump to address release issues in
  v7.0.0

## 7.0.0

### Major Changes

- [#6758](https://github.com/graphql-hive/console/pull/6758)
  [`0cf1194`](https://github.com/graphql-hive/console/commit/0cf1194c89d82f8dd2750fb6187234b084cbfc31)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add target management fields to the public GraphQL
  API schema.

  This includes the following fields and related types/fields:

  - `Mutation.updateTargetConditionalBreakingChangeConfiguration`
  - `Mutation.updateTargetSlug`
  - `Mutation.updateTargetDangerousChangeClassification`
  - `Mutation.createTarget`
  - `Mutation.deleteTarget`
  - `Mutation.createCdnAccessToken`
  - `Mutation.deleteCdnAccessToken`
  - `Target.conditionalBreakingChangeConfiguration`
  - `Target.failDiffOnDangerousChange`
  - `Target.cdnAccessTokens`
  - `Organization.availableOrganizationAccessTokenPermissionGroups`

  **BREAKING CHANGE** This renames existing types and fields within the private GraphQL schema.

### Minor Changes

- [#6771](https://github.com/graphql-hive/console/pull/6771)
  [`4dcd45a`](https://github.com/graphql-hive/console/commit/4dcd45a683dc6004df003732b94564cfcbf135d7)
  Thanks [@jdolle](https://github.com/jdolle)! - Add meta and subgraph data to coordinate insights
  page; Fix SubgraphChip service link

- [#6626](https://github.com/graphql-hive/console/pull/6626)
  [`2056307`](https://github.com/graphql-hive/console/commit/20563078449dbb6bf33bac3b2e5ac3d2c772fc6f)
  Thanks [@jdolle](https://github.com/jdolle)! - Add target breaking change setting to turn
  dangerous changes into breaking changes

- [#6658](https://github.com/graphql-hive/console/pull/6658)
  [`e6a970f`](https://github.com/graphql-hive/console/commit/e6a970f790b388ff29f97709acdd73136a79dfb7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Adjust GraphQL schema according to schema design
  policies.

- [#6701](https://github.com/graphql-hive/console/pull/6701)
  [`f2fe6c8`](https://github.com/graphql-hive/console/commit/f2fe6c83a2467fcb77ca49c8ed5405d3f6256157)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Print dangerous schema changes as own section in
  github changes.

- [#6662](https://github.com/graphql-hive/console/pull/6662)
  [`2b220a5`](https://github.com/graphql-hive/console/commit/2b220a560c4e4777a20ec0cf5f6ee68032055022)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support federation composition validation for
  `IMPLEMENTED_BY_INACCESSIBLE`.

- [#6678](https://github.com/graphql-hive/console/pull/6678)
  [`8fd9ad0`](https://github.com/graphql-hive/console/commit/8fd9ad018a50d54eb61759ea3e178790172d82d6)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Deprecate `CriticalityLevel` scalar and fields
  referencing it in favor of the `SeverityLevelType` scalar. Expose `SchemaChange.severityLevel` and
  `SchemaChange.severityReason` via the public API endpoint.

- [#6614](https://github.com/graphql-hive/console/pull/6614)
  [`c1d9c05`](https://github.com/graphql-hive/console/commit/c1d9c0568d5a4b4671aceb831883d348db5f9a55)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add new route `/graphql-public` to the `server`
  service which contains the public GraphQL API (fields and types will follow).

- [#6675](https://github.com/graphql-hive/console/pull/6675)
  [`ed66171`](https://github.com/graphql-hive/console/commit/ed66171a4b40d439183c91600bd17044dceafcb7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Updates the
  `@theguild/federation-composition` to `v0.18.1` that includes the following changes:

  - Support progressive overrides (`@override(label: "<value>")`)
  - Allow to use `@composeDirective` on a built-in scalar (like `@oneOf`)
  - Performance improvements (lazy compute of errors), especially noticeable in large schemas (2s ->
    600ms)
  - Ensure nested key fields are marked as `@shareable`
  - Stop collecting paths when a leaf field was reached (performance improvement)
  - Avoid infinite loop when entity field returns itself

- [#6665](https://github.com/graphql-hive/console/pull/6665)
  [`cb41478`](https://github.com/graphql-hive/console/commit/cb41478829e41695df686e47dd7673a9601d6008)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update
  `@theguild/federation-composition` to `v0.16.0`.

  - Support Apollo Federation `v2.7`, but without the progressive `@override`.
  - Support Apollo Federation `v2.8`, but without the `@context` and `@fromContext` directives.
  - Support Apollo Federation `v2.9`, including `@cost` and `@listSize` directives.

- [#6683](https://github.com/graphql-hive/console/pull/6683)
  [`ab774b7`](https://github.com/graphql-hive/console/commit/ab774b72bea54b88a2fb2ed1ea01f17a84970fc5)
  Thanks [@jdolle](https://github.com/jdolle)! - Make url optional for subsequent federated schema
  publishes

### Patch Changes

- [#6716](https://github.com/graphql-hive/console/pull/6716)
  [`1767037`](https://github.com/graphql-hive/console/commit/17670374485c36ac459150286559cb3b9edba596)
  Thanks [@jdolle](https://github.com/jdolle)! - Improve slack alert error logs

- [#6687](https://github.com/graphql-hive/console/pull/6687)
  [`349b78f`](https://github.com/graphql-hive/console/commit/349b78f39ad8fe28977f05e7542ca3e9c28092fd)
  Thanks [@jdolle](https://github.com/jdolle)! - Improve resource ID tooltip behavior

- [#6685](https://github.com/graphql-hive/console/pull/6685)
  [`a107ad3`](https://github.com/graphql-hive/console/commit/a107ad363bf2aee2ffab9d03ecf61ba0e32fac53)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix failing schema contract composition.

- [#6729](https://github.com/graphql-hive/console/pull/6729)
  [`cc552c9`](https://github.com/graphql-hive/console/commit/cc552c973c63f0a4b034b2c489c3925c347a7e75)
  Thanks [@jdolle](https://github.com/jdolle)! - Disable redis snapshotting

- [#6770](https://github.com/graphql-hive/console/pull/6770)
  [`8e02a49`](https://github.com/graphql-hive/console/commit/8e02a49b48e0cac392c2a3b4971867f39502c68b)
  Thanks [@jdolle](https://github.com/jdolle)! - Adjust contract logic to allow removing mutation
  and subscription types

- [#6602](https://github.com/graphql-hive/console/pull/6602)
  [`df3e5a2`](https://github.com/graphql-hive/console/commit/df3e5a23e5cd505d346a6d5719a4a7308aba208d)
  Thanks [@jdolle](https://github.com/jdolle)! - Added directions for publishing on no schema
  component

- [#6759](https://github.com/graphql-hive/console/pull/6759)
  [`132feb9`](https://github.com/graphql-hive/console/commit/132feb93e88667f5fdf118eb85f399e9e4330c56)
  Thanks [@jdolle](https://github.com/jdolle)! - Reduce usage service readiness threshold; Disable
  nagles algorithm and increase keepAlive from 60s to 180s for KafkaJS

- [#6713](https://github.com/graphql-hive/console/pull/6713)
  [`4f9aeae`](https://github.com/graphql-hive/console/commit/4f9aeae78a0f8feaec225dd7398aeda3000036f5)
  Thanks [@jdolle](https://github.com/jdolle)! - Do not store empty metadata in db

- [#6660](https://github.com/graphql-hive/console/pull/6660)
  [`5ff2aaa`](https://github.com/graphql-hive/console/commit/5ff2aaa624a6b9f6fe2a3633105ec7ce5ce188d5)
  Thanks [@jdolle](https://github.com/jdolle)! - fix schedule a meeting link

- [#6718](https://github.com/graphql-hive/console/pull/6718)
  [`fd9b160`](https://github.com/graphql-hive/console/commit/fd9b160015ee139bf8f09a41d14fa5446d60b3f5)
  Thanks [@jdolle](https://github.com/jdolle)! - upgrade 'got' package to fix TimeoutError case

- [#6752](https://github.com/graphql-hive/console/pull/6752)
  [`d0404db`](https://github.com/graphql-hive/console/commit/d0404db1cb0121357a9d7ea0fbdd33c03cdf243f)
  Thanks [@jdolle](https://github.com/jdolle)! - Improve external composer UX: Handle network errors
  gracefully, do not use native composer when testing, and improve settings UI

- [#6755](https://github.com/graphql-hive/console/pull/6755)
  [`60981bd`](https://github.com/graphql-hive/console/commit/60981bd94466acad9e0cf461b470c10ffbf80357)
  Thanks [@jdolle](https://github.com/jdolle)! - Correctly set usage service state to Ready after
  processing all of the fallback queue.

- [#6632](https://github.com/graphql-hive/console/pull/6632)
  [`9b2bec6`](https://github.com/graphql-hive/console/commit/9b2bec6185f939b378aa898215c56bb82119d0b6)
  Thanks [@jdolle](https://github.com/jdolle)! - Capture Stripe.js load error to avoid raising an
  unhandled error

- [#6706](https://github.com/graphql-hive/console/pull/6706)
  [`4435820`](https://github.com/graphql-hive/console/commit/4435820a2c666a39580156eea01a482768d61ab9)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve contract schema building for subgraphs
  using the `extend` keyword.

## 6.0.0

### Major Changes

- [#6556](https://github.com/graphql-hive/console/pull/6556)
  [`7b9129c`](https://github.com/graphql-hive/console/commit/7b9129cd86d4d76873734426b7044203bb389a2c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add organization access tokens; a new way to issue
  access tokens for performing actions with the CLI and doing usage reporting.

  **Breaking Change:** The `usage` service now requires environment variables for Postgres
  (`POSTGRES_SSL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`,
  `POSTGRES_PASSWORD`) and Redis (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`,
  `REDIS_TLS_ENABLED`).

  For more information please refer to the organization access token documentation.

  - [Product Update: Organization-Level Access Tokens for Enhanced Security & Flexibility](https://the-guild.dev/graphql/hive/product-updates/2025-03-10-new-access-tokens)
  - [Migration Guide: Moving from Registry Access Tokens to Access Tokens](https://the-guild.dev/graphql/hive/docs/migration-guides/organization-access-tokens)
  - [Access Token Documentation](https://the-guild.dev/graphql/hive/docs/management/access-tokens)

- [#6613](https://github.com/graphql-hive/console/pull/6613)
  [`0fd4d96`](https://github.com/graphql-hive/console/commit/0fd4d966ab6f01cd16a5716e1c33363ca5771127)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Restructure the environment variables used for the
  Hive Cloud hosting. While this is techincally a breaking change it will not really affect people
  self-hosting Hive.

  **Breaking**: Remove unused environment variable options `HIVE_REPORTING`,
  `HIVE_REPORTING_ENDPOINT` and `HIVE_USAGE_DATA_RETENTION_PURGE_INTERVAL_MINUTES` from the `server`
  service.

  These environment variables are obsolete since the Hive GraphQL schema is reported via the Hive
  CLI instead.

  **Breaking**: Replace the environment variable option `HIVE` with `HIVE_USAGE`, rename environment
  variable option `HIVE_API_TOKEN` to `HIVE_USAGE_ACCESS_TOKEN` for the `server` service. Require
  providing the `HIVE_USAGE_ACCESS_TOKEN` environment variable if `HIVE_USAGE` is set to `1`.

### Patch Changes

- [#6594](https://github.com/graphql-hive/console/pull/6594)
  [`06e7012`](https://github.com/graphql-hive/console/commit/06e70129689570f3602cd01eae4ef7f1dfe24f00)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix insights range if selecting same start and end

- [#6633](https://github.com/graphql-hive/console/pull/6633)
  [`a5e00f2`](https://github.com/graphql-hive/console/commit/a5e00f260a6f21b3207fc8257c302e68a0d671b1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix Federation composition error when having an
  inaccessible default value on an inaccessible field.

- [#6609](https://github.com/graphql-hive/console/pull/6609)
  [`1c44345`](https://github.com/graphql-hive/console/commit/1c4434522385c744bd484f7964d3c92f73f3641f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Mark usage-ingestor as unhealthy when
  Kafka consumer crashed

- [#6584](https://github.com/graphql-hive/console/pull/6584)
  [`d1e6ab0`](https://github.com/graphql-hive/console/commit/d1e6ab094b881a6ce08c55f68a8ecd6018c47613)
  Thanks [@jdolle](https://github.com/jdolle)! - Add readonly resource ID to settings pages

- [#6585](https://github.com/graphql-hive/console/pull/6585)
  [`c0d9ca3`](https://github.com/graphql-hive/console/commit/c0d9ca30d4c360e75be7902d2693303ffe622975)
  Thanks [@jdolle](https://github.com/jdolle)! - Restrict new service names to 64 characters,
  alphanumberic, `_` and `-`.

- [#6607](https://github.com/graphql-hive/console/pull/6607)
  [`18f82b4`](https://github.com/graphql-hive/console/commit/18f82b4e3fddb507f685cb85d48e3f42a87a0039)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Ensure all materialized views have
  correct TTL

## 5.1.3

### Patch Changes

- [#6553](https://github.com/graphql-hive/console/pull/6553)
  [`f0fe03c`](https://github.com/graphql-hive/console/commit/f0fe03c9464815b5f11b8e4715f0182959e8d363)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Standardize the design and content of
  all email templates for consistency.

- [#6571](https://github.com/graphql-hive/console/pull/6571)
  [`bf06e94`](https://github.com/graphql-hive/console/commit/bf06e94f5f115770f229b0b6e9961a44f057fa4d)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds ability to all services to write a
  heap dump to a disk when SIGUSR1 signal is received

- [#6593](https://github.com/graphql-hive/console/pull/6593)
  [`ef1efbb`](https://github.com/graphql-hive/console/commit/ef1efbb8c26e40a715e5bb14c99b0734c095bef7)
  Thanks [@jdolle](https://github.com/jdolle)! - Fix operation insights showing loading for missing
  operations

- [#6582](https://github.com/graphql-hive/console/pull/6582)
  [`bb2f2aa`](https://github.com/graphql-hive/console/commit/bb2f2aa30f6cd4a5427e7d977c816d7e78499ea2)
  Thanks [@jdolle](https://github.com/jdolle)! - Adds optional url argument to schema checks

- [#6586](https://github.com/graphql-hive/console/pull/6586)
  [`e10de03`](https://github.com/graphql-hive/console/commit/e10de0370cd713db1815eee9cabb52725cf5c3b9)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Corrected an issue where fields from
  type extensions were not marked as unused when appropriate

- [#6542](https://github.com/graphql-hive/console/pull/6542)
  [`719e3e6`](https://github.com/graphql-hive/console/commit/719e3e68643c673c5539cc18b68772661e52a857)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Consolidates email templating logic
  into the `emails` service.

## 5.1.2

### Patch Changes

- [#6518](https://github.com/graphql-hive/console/pull/6518)
  [`a8a2da5`](https://github.com/graphql-hive/console/commit/a8a2da5d65c09885dd3aa6d9bbe017cf4b9efebf)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Ensure response body is read before
  timeout to avoid abort errors in S3 client (CDN)

- [#6536](https://github.com/graphql-hive/console/pull/6536)
  [`6cdcef1`](https://github.com/graphql-hive/console/commit/6cdcef1b2a1f75da372f22ddeefe3951a85fd02c)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds an index to
  coordinates\_(daily,hourly,minutely) tables to speedup the get_top_operations_for_types ClickHoue
  query.

  Reading of type and fields usage statisticts should be noticeably faster now on big datasets.

## 5.1.1

### Patch Changes

- [#6502](https://github.com/graphql-hive/console/pull/6502)
  [`cef7fd8`](https://github.com/graphql-hive/console/commit/cef7fd88e4929942bcaf07aaf3bc226c5d9a38cd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update @theguild/federation-composition
  to 0.14.4

  - Fix a child data type field not being accessible via interfaceObject
  - Respect inaccessible enum values while creating the public schema from the supergraph AST

## 5.1.0

### Minor Changes

- [#6449](https://github.com/graphql-hive/console/pull/6449)
  [`0504530`](https://github.com/graphql-hive/console/commit/05045306b789e97ec39cbd2c8ee2b4f1b721dc9e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Modify GraphQL fields used by CLI to accept an
  optional specified target that is used for identifying the affected target instead of resolving
  the target from the access token.

### Patch Changes

- [#6472](https://github.com/graphql-hive/console/pull/6472)
  [`4d3d6fc`](https://github.com/graphql-hive/console/commit/4d3d6fcdc2d7f65e6366fd76a058c3f687c4da4c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve the usage reporting endpoint error
  responses to include all the errors for invalid JSON bodies.

- [#6455](https://github.com/graphql-hive/console/pull/6455)
  [`6924a1a`](https://github.com/graphql-hive/console/commit/6924a1abf91c1c663d752949031e0a5c4078392a)
  Thanks [@jasonkuhrt](https://github.com/jasonkuhrt)! - A minor defect in Laboratory has been fixed
  that previously caused the application to crash when local storage was in a particular state.

## 5.0.0

### Major Changes

- [#6231](https://github.com/graphql-hive/console/pull/6231)
  [`b7e4052`](https://github.com/graphql-hive/console/commit/b7e4052ecfd8f70fefe39c27886619a24faa7526)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - New permission system for organization member
  roles.

  The existing scopes assigned to organization members have been replaced with a permissions-based
  system, enabling more granular access control and role-based access control (RBAC) in Hive.

  **Breaking Changes**

  - **Viewer Role Adjustments** – Members with the default Viewer role can no longer create targets
    or projects.
  - **Restricted Role Management** – Permissions for inviting, removing, and assigning roles have
    been revoked. An admin must manually reassign these permissions where needed.
  - **Expanded Role Assignment** Capabilities – Members with permissions to manage invites, remove
    members, or modify roles can now grant additional permissions without restrictions. Caution is
    advised when assigning these rights, as they should be reserved for "Admin" roles.

  These changes enhance security and provide greater flexibility in managing user permissions across
  organizations.

### Minor Changes

- [#6378](https://github.com/graphql-hive/console/pull/6378)
  [`f14daa8`](https://github.com/graphql-hive/console/commit/f14daa89760149d6b1eb45d5351d73c4376b7418)
  Thanks [@jasonkuhrt](https://github.com/jasonkuhrt)! - You can now set HTTP headers in your
  [Laboratory Preflight Script](https://the-guild.dev/graphql/hive/docs/dashboard/laboratory/preflight-scripts).
  Every time you run a request from Laboratory, your preflight headers, if any, will be merged into
  the request before it is sent.

  You achieve this by interacting with the
  [`Headers`](https://developer.mozilla.org/docs/web/api/headers) instance newly available at
  `lab.request.headers`. For example, this script would would add a `foo` header with the value
  `bar` to every Laboratory request.

  ```ts
  lab.request.headers.set('foo', 'bar')
  ```

  A few notes about how headers are merged:

  1. Unlike static headers, preflight headers do not receive environment variable substitutions on
     their values.
  2. Preflight headers take precedence, overwriting any same-named headers already in the Laboratory
     request.

  Documentation for this new feature is available at
  https://the-guild.dev/graphql/hive/docs/dashboard/laboratory/preflight-scripts#http-headers.

- [#6123](https://github.com/graphql-hive/console/pull/6123)
  [`abfd1b1`](https://github.com/graphql-hive/console/commit/abfd1b1ea9b6850683f31c152516d9e0d97d94aa)
  Thanks [@Intellicode](https://github.com/Intellicode)! - encode postgres variables and introduce
  optional password

- [#6412](https://github.com/graphql-hive/console/pull/6412)
  [`f352bba`](https://github.com/graphql-hive/console/commit/f352bbac977902120527fbea2afb0b0b7dd253fb)
  Thanks [@Intellicode](https://github.com/Intellicode)! - Added a new environment variable
  `PROMETHEUS_METRICS_PORT` to control the promethus port of the policy service. The default value
  is `10254` (no action needed).

### Patch Changes

- [#6398](https://github.com/graphql-hive/console/pull/6398)
  [`0e4be14`](https://github.com/graphql-hive/console/commit/0e4be14256937f492efcb4a7dc97b59918274a2a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Remove the db leftovers related to
  activities (no longer a thing)

- [#6433](https://github.com/graphql-hive/console/pull/6433)
  [`a902d8b`](https://github.com/graphql-hive/console/commit/a902d8bb974c0ea707a17ff3d921a6cf13972ead)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Improves validation for operation
  durations and error totals. Prevents processing of invalid usage report data.

- [#6374](https://github.com/graphql-hive/console/pull/6374)
  [`393ece7`](https://github.com/graphql-hive/console/commit/393ece7eab93ed0b7873e4428f78a5c27cf764fa)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adjust the Kafka message size
  estimation only when Kafka gives back `MESSAGE_TOO_LARGE` error

- [#6358](https://github.com/graphql-hive/console/pull/6358)
  [`ab06518`](https://github.com/graphql-hive/console/commit/ab065182d89e6d7e4c90469d0bcaadacfa4c3b1e)
  Thanks [@jdolle](https://github.com/jdolle)! - Use sum instead of max of top request counts for
  breaking changes calculation

## 4.1.0

### Minor Changes

- [#6400](https://github.com/graphql-hive/console/pull/6400)
  [`d2a4387`](https://github.com/graphql-hive/console/commit/d2a4387b64fe71340159c536a05dd38b1a35c751)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Display logs from the Preflight Script
  in Laboratory

- [#6348](https://github.com/graphql-hive/console/pull/6348)
  [`e754700`](https://github.com/graphql-hive/console/commit/e75470021282b84b622560c8a991c196ee7f24d7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds ability to select a default role
  for new OIDC users

- [#6351](https://github.com/graphql-hive/console/pull/6351)
  [`ba20748`](https://github.com/graphql-hive/console/commit/ba207485ad8b8868c73b736397c8f7f2416b86d3)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Added a new environment variable
  `OPENTELEMETRY_TRACE_USAGE_REQUESTS` for `rate-limit` and `tokens` services.

  Self-hosters who wish to report telemetry information for `usage` service, can opt-in and set
  `OPENTELEMETRY_TRACE_USAGE_REQUESTS=1` to these services. This will skip sampling and will always
  trace requests originating from the `usage` service.

- [#6388](https://github.com/graphql-hive/console/pull/6388)
  [`a8ff443`](https://github.com/graphql-hive/console/commit/a8ff443307fa9929f0b466c6a83d695bd5e707dd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add multi-column sort to Insights >
  Operations table

- [#6389](https://github.com/graphql-hive/console/pull/6389)
  [`781b140`](https://github.com/graphql-hive/console/commit/781b140ffb5d5256913941763b79665965c53a6c)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Show Impact metric in the Operations
  list on the Insights page. Impact equals to the total time spent on this operation in the selected
  period in seconds. It helps assess which operations contribute the most to overall latency.

  ```
  Impact = Requests * avg/1000
  ```

- [#6393](https://github.com/graphql-hive/console/pull/6393)
  [`84fd770`](https://github.com/graphql-hive/console/commit/84fd770b6c7bc3fdd62af6d337889e3c2596ef15)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add type definitions of global.lab to
  Preflight Script editor

- [#6351](https://github.com/graphql-hive/console/pull/6351)
  [`ba20748`](https://github.com/graphql-hive/console/commit/ba207485ad8b8868c73b736397c8f7f2416b86d3)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Added OpenTelemetry traces to Usage service
  using a new `OPENTELEMETRY_COLLECTOR_ENDPOINT` env var.

  This option is disabled by default for self-hosting, you can opt-in by setting
  `OPENTELEMETRY_COLLECTOR_ENDPOINT`.

### Patch Changes

- [#6386](https://github.com/graphql-hive/console/pull/6386)
  [`d19229f`](https://github.com/graphql-hive/console/commit/d19229fb6e4f48237a925987ff1a60b6b651a784)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Remove the code leftovers related to
  activities (no longer a thing)

- [#6380](https://github.com/graphql-hive/console/pull/6380)
  [`40213fb`](https://github.com/graphql-hive/console/commit/40213fb7dc39cfb2688e6127e8fe2658f7fceb7f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update
  `@theguild/federation-composition` to
  [v0.14.3](https://github.com/the-guild-org/federation/releases/tag/v0.14.3)

- [#6399](https://github.com/graphql-hive/console/pull/6399)
  [`607192e`](https://github.com/graphql-hive/console/commit/607192eaa5d6c3dcc6a2d0c4ff406a7d6f06ca42)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Disable "select organization" dropdown
  for OIDC accounts

## 4.0.1

### Patch Changes

- [`c6a21ff`](https://github.com/graphql-hive/console/commit/c6a21ffa1bbb32afef86fd137ec3aec1e9b48545)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Bump version to test release flow

## 4.0.0

### Major Changes

- [#6259](https://github.com/graphql-hive/console/pull/6259)
  [`1168564`](https://github.com/graphql-hive/console/commit/1168564ef06e10e90381ad7808f46c5f205be3ea)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - No longer support the legacy registry
  models. Announcement https://the-guild.dev/blog/graphql-hive-improvements-in-schema-registry

### Minor Changes

- [#6340](https://github.com/graphql-hive/console/pull/6340)
  [`3183f5a`](https://github.com/graphql-hive/console/commit/3183f5a9b40ab389b413199747aeff4b9ea1cbe8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Remove the legacy member role assignment wizard.

- [#6341](https://github.com/graphql-hive/console/pull/6341)
  [`2fa3352`](https://github.com/graphql-hive/console/commit/2fa33520b36e4a0662ab9c74abc06fb4705d2a53)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Allow to close the last tab in
  Laboratory

- [#6254](https://github.com/graphql-hive/console/pull/6254)
  [`b58d2c5`](https://github.com/graphql-hive/console/commit/b58d2c5fdb856a3f0710d1551e1e9306eb7cbcc0)
  Thanks [@jdolle](https://github.com/jdolle)! - Add option for checking breaking changes by a fixed
  request count

### Patch Changes

- [#6332](https://github.com/graphql-hive/console/pull/6332)
  [`6b9192c`](https://github.com/graphql-hive/console/commit/6b9192c71845d3312cb2a9b1e7c1d9a552fb6f8f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Assigns custom roles to members without
  a role to complete https://the-guild.dev/graphql/hive/product-updates/2023-12-05-member-roles

- [#6369](https://github.com/graphql-hive/console/pull/6369)
  [`b40cabd`](https://github.com/graphql-hive/console/commit/b40cabda747641f13fcf183557ce023d12eec2b1)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix the audit log export

- [#6368](https://github.com/graphql-hive/console/pull/6368)
  [`0c2e953`](https://github.com/graphql-hive/console/commit/0c2e953fac76cff1c7cb397468c480c28366f665)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix connecting slack integration.

- [#6365](https://github.com/graphql-hive/console/pull/6365)
  [`bab2cf0`](https://github.com/graphql-hive/console/commit/bab2cf08a596892bc2c7ac0a1e5b00673808bff6)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Fix release and package flow for Docker
  images of `hive`

## 3.0.0

### Major Changes

- [#6066](https://github.com/graphql-hive/console/pull/6066)
  [`e747e4c`](https://github.com/graphql-hive/console/commit/e747e4cd44e6516809754e1be2999a698153c598)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Drop user accounts and organization not linked to a
  SuperTokens account.

  This is mainly a cleanup for legacy accounts on Hive Cloud that were not migrated from Auth0 some
  years ago. It should not affect self-hosters.

### Minor Changes

- [#6261](https://github.com/graphql-hive/console/pull/6261)
  [`09c01d6`](https://github.com/graphql-hive/console/commit/09c01d6491dae9c3963de04c6e841ee9813bcaa3)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds a response validation of the POST
  https://slack.com/api/oauth.v2.access request.

  This request is made when connecting Slack to Hive. This is to ensure that the response is a JSON
  object and that it contains the expected keys and provide informative error messages if it does
  not.

### Patch Changes

- [#6265](https://github.com/graphql-hive/console/pull/6265)
  [`cecd95b`](https://github.com/graphql-hive/console/commit/cecd95bc6cdc29f6b81df8b221858201b49184ce)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Relax `uuid` check for external IDs in
  audit log metadata. Fixes https://github.com/graphql-hive/console/issues/6264

- [#6262](https://github.com/graphql-hive/console/pull/6262)
  [`d98e146`](https://github.com/graphql-hive/console/commit/d98e1468a27fafde5b080c0b0ce02696ce4a589d)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Resolve the issue where the laboratory
  mocked endpoint consistently returns: "Please publish your first schema to Hive."

- [#6267](https://github.com/graphql-hive/console/pull/6267)
  [`817fed3`](https://github.com/graphql-hive/console/commit/817fed329bf10a1c31ab253c00bd4efa13e6699c)
  Thanks [@dotansimha](https://github.com/dotansimha)! - bugfix: `scrollIntoView` is not a function
  in lab page (fixed https://github.com/graphql-hive/console/issues/6263)

- [#6282](https://github.com/graphql-hive/console/pull/6282)
  [`a7f9d50`](https://github.com/graphql-hive/console/commit/a7f9d50fb9026536311b4c973433d38e17ab0e73)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix editor state and operation handling
  in Laboratory.

  When opening a new tab or selecting a saved operation, the editor incorrectly populated the query,
  defaulting to the active query. This made it impossible to view the selected operation.
  Additionally, the submit button for saving an operation was always disabled, even when the form
  was in a valid state.

## 2.1.0

### Minor Changes

- [#5564](https://github.com/graphql-hive/console/pull/5564)
  [`e0eb3bd`](https://github.com/graphql-hive/console/commit/e0eb3bdb289c6349f51d71ba0570328d2f4e98d7)
  Thanks [@dimaMachina](https://github.com/dimaMachina)! - Add preflight scripts for laboratory.

  It is now possible to add a preflight script within the laboratory that executes before sending a
  GraphQL request.
  [Learn more.](https://the-guild.dev/graphql/hive/product-updates/2024-12-27-preflight-script)

- [#5530](https://github.com/graphql-hive/console/pull/5530)
  [`38c14e2`](https://github.com/graphql-hive/console/commit/38c14e21d8fd76f04a750ede3aac07aa10685687)
  Thanks [@TuvalSimha](https://github.com/TuvalSimha)! - Add organization audit log.

  Each organization now has an audit log of all user actions that can be exported by admins.
  Exported audit logs are stored on the pre-configured S3 storage.

  In case you want to store exported audit logs on a separate S3 bucket, you can use the
  `S3_AUDIT_LOG` prefixed environment variables for the configuration.

  [Learn more.](https://graphql-hive.com/product-updates/2024-12-27-audit-logs)

- [#6234](https://github.com/graphql-hive/console/pull/6234)
  [`eecd099`](https://github.com/graphql-hive/console/commit/eecd099309e2308f216c709a1fe23f15f6d6318b)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds
  `lab.prompt(message, defaultValue)` to Preflight Script API

### Patch Changes

- [#6232](https://github.com/graphql-hive/console/pull/6232)
  [`ff44b62`](https://github.com/graphql-hive/console/commit/ff44b62aebc4b5d4e3ff321ad3ed59694d94330a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Improvements to UI of Preflight Script
  (Laboratory)

- [#6233](https://github.com/graphql-hive/console/pull/6233)
  [`7b0c920`](https://github.com/graphql-hive/console/commit/7b0c920c578a9220c0bad69d2f6b69023f8beece)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Tiny UI fixes

## 2.0.1

### Patch Changes

- [#6158](https://github.com/graphql-hive/console/pull/6158)
  [`3093c9f`](https://github.com/graphql-hive/console/commit/3093c9fc23ab0a53926a187a91fe93ef6fee5be1)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Added missing index for postgres db field
  "schema_version_changes.schema_version_id"

## 2.0.0

### Major Changes

- [#6142](https://github.com/graphql-hive/console/pull/6142)
  [`25f1460`](https://github.com/graphql-hive/console/commit/25f14604f482ac42826c63ec08bc108a67d37fd0)
  Thanks [@TuvalSimha](https://github.com/TuvalSimha)! - Upgrade the PostgreSQL version for Docker
  Compose from version 14.13 to use 16.4.

  **This change is published as major, as it requires attention based on your setup.**

  For self-hosters with a managed database, we recommend upgrading PostgreSQL based on your Cloud
  provider's or IT's recommendation.

  For self-hosters running in Docker, you can read about
  [upgrading PostgreSQL in a Docker container here](https://helgeklein.com/blog/upgrading-postgresql-in-docker-container/).

  > The Hive data that was previously created with PostgreSQL v14 is compatible with v16.

### Patch Changes

- [#6156](https://github.com/graphql-hive/console/pull/6156)
  [`b6eb5d0`](https://github.com/graphql-hive/console/commit/b6eb5d0e71e5b1d7575756d440bdbfb3116950b7)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Improvement for OTEL tracing and added
  missing attributes

- [#6156](https://github.com/graphql-hive/console/pull/6156)
  [`b6eb5d0`](https://github.com/graphql-hive/console/commit/b6eb5d0e71e5b1d7575756d440bdbfb3116950b7)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Performance improvements for Postgres DB
  calls (specifically `getSchemasOfVersion`, see https://github.com/graphql-hive/console/pull/6154)

## 1.2.4

### Patch Changes

- [#6138](https://github.com/graphql-hive/console/pull/6138)
  [`349a67d`](https://github.com/graphql-hive/console/commit/349a67d09ccadc22c0f3b84ceafa7157c5f3e979)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Prevent stripe.js from loading
  automatically

## 1.2.3

### Patch Changes

- [#6115](https://github.com/graphql-hive/console/pull/6115)
  [`0d7ce02`](https://github.com/graphql-hive/console/commit/0d7ce02082a5ac02111b888132209ee0ef34c831)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Move information about target and
  organization to logger's metadata in usage service

- [#6121](https://github.com/graphql-hive/console/pull/6121)
  [`6d78547`](https://github.com/graphql-hive/console/commit/6d78547a0f29a732713052d33d207396144e0998)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Make optional properties optional or
  nullable in usage report v2

- [#6111](https://github.com/graphql-hive/console/pull/6111)
  [`cffd08a`](https://github.com/graphql-hive/console/commit/cffd08a53d7e5a53bb59fa68e940b693e9102485)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix a missing @join\_\_field on a query
  field where @override is used, but not in all subgraphs.

## 1.2.2

### Patch Changes

- [#6065](https://github.com/graphql-hive/console/pull/6065)
  [`9297f33`](https://github.com/graphql-hive/console/commit/9297f33ad6c2c0a5ff77ea92c43ca5c97fd9a2d8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Allow organizations without a GitHub or Slack
  integration to add and manage integrations.

## 1.2.1

### Patch Changes

- [#5945](https://github.com/graphql-hive/console/pull/5945)
  [`03f08ca`](https://github.com/graphql-hive/console/commit/03f08ca68bb675696208a31ca002c74a628edbbb)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Require "registry write" permissions for approving
  failed schema checks, schema versions, and the laboratory.

- [#5989](https://github.com/graphql-hive/console/pull/5989)
  [`a87a541`](https://github.com/graphql-hive/console/commit/a87a541153db901fc41fae0f33cd5de52324d8dd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Retry calls to Github API when creating
  check-runs

- [#5989](https://github.com/graphql-hive/console/pull/5989)
  [`a87a541`](https://github.com/graphql-hive/console/commit/a87a541153db901fc41fae0f33cd5de52324d8dd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Inform users about Github API issues
  when creating check runs

## 1.2.0

### Minor Changes

- [#5897](https://github.com/graphql-hive/console/pull/5897)
  [`cd9a13c`](https://github.com/graphql-hive/console/commit/cd9a13cd4f98700c79db89ac4dd60f0578442efe)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update `supertokens-postgresql` to `9.3`.

### Patch Changes

- [#5924](https://github.com/graphql-hive/console/pull/5924)
  [`5ad52ba`](https://github.com/graphql-hive/console/commit/5ad52ba4d1ad002a8e3b233cefe762324113cf6a)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix logging for invalid operation body within usage
  reporting.

## 1.1.1

### Patch Changes

- [#5907](https://github.com/graphql-hive/console/pull/5907)
  [`5adfb6c`](https://github.com/graphql-hive/console/commit/5adfb6c39dce653ffef9fdf6af9a6a582cac0231)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Remove option to remove the organization owner from
  the organization.

## 1.1.0

### Minor Changes

- [#5884](https://github.com/graphql-hive/platform/pull/5884)
  [`8aec41a`](https://github.com/graphql-hive/platform/commit/8aec41a36ee897aad0057e6817a9433a545fd18d)
  Thanks [@andriihrachov](https://github.com/andriihrachov)! - Add `REDIS_TLS_ENABLED` environment
  variable for enabling and disabling Redis TLS for `emails`, `schema`, `tokens`, `webhooks` and
  `server` services.

- [#5889](https://github.com/graphql-hive/platform/pull/5889)
  [`0eef5ed`](https://github.com/graphql-hive/platform/commit/0eef5edc6b8a940d3e70b5ea322a73ac6af07d33)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Update `supertokens-postgresql` to `8.0`.

## 1.0.2

### Patch Changes

- [#5872](https://github.com/graphql-hive/platform/pull/5872)
  [`580d349`](https://github.com/graphql-hive/platform/commit/580d349d45b85dc6103b39c6e07bc3d81e5d3bc9)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump @theguild/federation-composition
  to v0.14.1

## 1.0.1

### Patch Changes

- [#5858](https://github.com/graphql-hive/platform/pull/5858)
  [`11973c7`](https://github.com/graphql-hive/platform/commit/11973c773a3251d4b00d1bd4a509e06bfaf5288f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - fix: conditional breaking changes form
  [#5852](https://github.com/graphql-hive/platform/pull/5852)

## 1.0.0

**This is the first officially versioned release of Hive.**

While it has been available and in use for some time, this marks the introduction of formal
versioning and a changelog to track future updates and improvements.
