# @graphql-hive/cli

## 0.68.1

### Patch Changes

- [#8756](https://github.com/graphql-hive/console/pull/8756)
  [`2f51407`](https://github.com/graphql-hive/console/commit/2f51407d2c819103d8c238c424834262ee144738)
  Thanks [@jdolle](https://github.com/jdolle)! - `app:create` retries a failed document upload batch
  at most twice (three attempts in total) instead of five times.

## 0.68.0

### Minor Changes

- [#8734](https://github.com/graphql-hive/console/pull/8734)
  [`a6eaf2e`](https://github.com/graphql-hive/console/commit/a6eaf2e857ccb2a1d6f9293d3cd26b2d4e3bf79e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Validate and preprocess app deployment documents in
  the CLI before uploading them, reducing server-side processing and rejecting invalid operations
  earlier.

### Patch Changes

- [#8726](https://github.com/graphql-hive/console/pull/8726)
  [`e085b8e`](https://github.com/graphql-hive/console/commit/e085b8e1ef7a9197d285b2f3b4264fb47bf1a963)
  Thanks [@jdolle](https://github.com/jdolle)! - Surface the registry's request id on HTTP errors.
  `HTTPResponseError` thrown by the core HTTP client now carries the `x-request-id` the server
  returned, and the CLI prints it as `Request ID` on HTTP error responses (for example a request
  rejected because its body is too large), the same way it already does for GraphQL errors.
  Previously only the client-generated id was visible, which does not match anything on the server.

- Updated dependencies
  [[`e085b8e`](https://github.com/graphql-hive/console/commit/e085b8e1ef7a9197d285b2f3b4264fb47bf1a963)]:
  - @graphql-hive/core@0.23.2

## 0.67.1

### Patch Changes

- [#8711](https://github.com/graphql-hive/console/pull/8711)
  [`b5839de`](https://github.com/graphql-hive/console/commit/b5839dec170ce82afc839cb5d81c55cf6f2a6606)
  Thanks [@jdolle](https://github.com/jdolle)! - `hive app:create` now waits up to 55 seconds for
  each document upload request (previously 20 seconds), the same as the schema commands. Slow
  uploads completed on the server but the CLI gave up, retried the whole batch, and finally failed
  with a network error.

## 0.67.0

### Minor Changes

- [#8678](https://github.com/graphql-hive/console/pull/8678)
  [`5124f15`](https://github.com/graphql-hive/console/commit/5124f154e100819f19fbe2c4b94540f8e04ac560)
  Thanks [@jdolle](https://github.com/jdolle)! - `hive schema:publish --github` now exits with code
  1 (error `[300]`) when the publish is rejected, for example by breaking changes or
  `--fail-on-composition-error`. Previously it exited with 0 whenever the GitHub check-run was
  updated. `--force` still reports a forced success, as without `--github`.

  **Note for self-hosted Hive:** `hive schema:publish --github` relies on a new field added to the
  Hive GraphQL API (`GitHubSchemaPublishSuccess`). If you self-host Hive and the CLI reports error
  `[125]` (unsupported Hive server version), deploy the latest Hive backend before upgrading the
  CLI.

### Patch Changes

- [#8670](https://github.com/graphql-hive/console/pull/8670)
  [`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-7mx3-vvmw-hjmv](https://github.com/advisories/GHSA-7mx3-vvmw-hjmv).

- Updated dependencies
  [[`e2edb6b`](https://github.com/graphql-hive/console/commit/e2edb6ba53215786d17da7e16840f3562eac0e37)]:
  - @graphql-hive/core@0.23.1

## 0.66.0

### Minor Changes

- [#8556](https://github.com/graphql-hive/console/pull/8556)
  [`0961843`](https://github.com/graphql-hive/console/commit/0961843fdac3b2f9ae0e25d05bc48d25d2c63d4d)
  Thanks [@jdolle](https://github.com/jdolle)! - Report every CLI failure with an accurate, unique
  and documented error code, and report schema check results accurately when using `--github`.

  **Note for self-hosted Hive:** `hive schema:check --github` relies on new fields added to the Hive
  GraphQL API (`GitHubSchemaCheckSuccess`). If you self-host Hive and the CLI reports error `[125]`
  (unsupported Hive server version), deploy the latest Hive backend before upgrading the CLI.

  **Behavior changes**

  - `hive schema:check --github` now exits with code 1 when the schema check fails. Previously it
    exited with 0 whenever the GitHub check-run was created. The failure is reported as error
    `[202]`, and `--forceSafe` now approves failed checks in GitHub mode as well.
  - A failed schema check now prints `Schema check failed. [202]` to stderr. The exit code is
    unchanged.
  - `hive schema:check --forceSafe` now exits with code 1 (error `[203]`) when the registry did not
    store a schema check that could be approved, instead of exiting with 0.
  - Exit codes are now consistent: `1` means the operation failed, `2` means a request timed out,
    and `3` means invalid input or setup. Invalid arguments and flags, and unknown commands, now
    exit with `3` instead of `2`. A missing CDN endpoint now exits with `3` instead of `1`.
  - Error codes are now unique: `InvalidVersionIdError` is now `[122]` and `ConflictingOptionsError`
    is now `[123]` (both were `[121]`).
  - An invalid `hive.json`, a file set with `HIVE_CONFIG` that does not exist, or an unknown
    `HIVE_SPACE` now fails with error `[100]`. Previously the configuration was silently ignored, so
    the CLI fell back to the default registry endpoint or reported a missing access token. The
    legacy `{ "registry": "...", "token": "..." }` format is read correctly again.
  - Passing both a schema file and `--revision` to `hive schema:publish` now fails with error
    `[123]` instead of ignoring the file.
  - `hive schema:check --github` needs a Hive server that includes the new
    `GitHubSchemaCheckSuccess` fields. Older servers are reported with error `[125]`.

  **New error codes**

  - `[124]` Access denied: the access token is missing the named permission, or the target does not
    exist or is not accessible to the token. Previously reported as `[115]`.
  - `[125]` Unsupported Hive server version: the server does not know a field the CLI sends.
  - `[126]` A request to the Hive registry or CDN timed out. The operation may still have completed
    on the server, so check the result before retrying. Other network errors, including timeouts
    while introspecting a GraphQL service, remain `[114]`.
  - `[127]` Invalid command input, `[128]` invalid header.
  - `[202]` Schema check failed, `[203]` schema check approval failed.

  Other errors that were previously reported as unexpected (`[199]`) or without a code now use the
  matching code, for example a missing or empty schema file (`[200]`, `[201]`), invalid SDL in
  `schema:check` (`[301]`), an invalid CDN access token (`[107]`), HTTP error responses (`[113]`)
  and `--forceSafe` without a target slug (`[102]`). `hive introspect` reports a missing, empty or
  invalid schema file as `[200]`, `[201]` or `[301]`, and keeps `[116]` for GraphQL services that
  cannot be introspected. `hive schema:check` now also reports a URL that cannot be introspected as
  `[116]` (exit code `1`) instead of `[200]`, like `schema:publish`, and introspection errors name
  the URL that failed. Invalid registry access tokens that expired are reported as `[106]`.

  **New features**

  - `hive schema:publish --github` prints the reason for errors that happen before a GitHub
    check-run is created, such as an unknown revision.
  - `hive app:create` shows why the app name or version was rejected.
  - Error messages link to the documentation of their error code, and the CLI README lists every
    error code with its exit code and recommended fix. The list is also published as `errors.json`
    in the package.

- [#8558](https://github.com/graphql-hive/console/pull/8558)
  [`cc0119f`](https://github.com/graphql-hive/console/commit/cc0119f0396aa483060d1395c964f7d78f41bcc5)
  Thanks [@jdolle](https://github.com/jdolle)! - Show when a pushed schema revision expires.

  - `hive schema:push` shows when the pushed revision expires, and warns when `--service` is ignored
    for a single-schema project.

### Patch Changes

- Updated dependencies
  [[`0961843`](https://github.com/graphql-hive/console/commit/0961843fdac3b2f9ae0e25d05bc48d25d2c63d4d),
  [`e30136b`](https://github.com/graphql-hive/console/commit/e30136baac429d2d77992e693b5a02eab5147977)]:
  - @graphql-hive/core@0.23.0

## 0.65.0

### Minor Changes

- [#8543](https://github.com/graphql-hive/console/pull/8543)
  [`e45846e`](https://github.com/graphql-hive/console/commit/e45846e63782e12c35b9ba068721e732769deafe)
  Thanks [@BuddhaBing](https://github.com/BuddhaBing)! - Add a `--header`/`-H` flag to `hive dev` to
  attach custom HTTP headers to the introspection requests sent to locally running subgraphs. This
  allows introspecting subgraphs that require authentication.

  Headers are supplied in `key:value` format. The position of `--header` relative to `--service`
  determines its scope:

  - A `--header` specified **before** the first `--service` is global and applies to every service.
  - A `--header` specified **after** a `--service` applies only to that service (until the next
    `--service`), and overrides a global header of the same name for that service.

  Services provided via `--schema` are not introspected, so headers don't apply to them.

  ```shell
  hive dev \
    --header 'X-Foo:shared-value' \
    --service reviews --url http://localhost:3001/graphql --header 'Authorization:Bearer REVIEWS_TOKEN' \
    --service products --url http://localhost:3002/graphql --header 'Authorization:Bearer PRODUCTS_TOKEN'
  ```

  In this example:

  - `reviews` receives `X-Foo:shared-value` and `Authorization:Bearer REVIEWS_TOKEN`
  - `products` receives `X-Foo:shared-value` and `Authorization:Bearer PRODUCTS_TOKEN`

  **Note:** a `--header` placed after the _last_ `--service` scopes only to that final service — it
  is not treated as global. To apply a header to every service, place it before the first
  `--service`:

  ```shell
  # ✅ applies to both reviews and products
  hive dev --header 'X-Foo:shared-value' --service reviews --url ... --service products --url ...
  
  # ⚠️ applies to `products` only, NOT to `reviews`
  hive dev --service reviews --url ... --service products --url ... --header 'X-Foo:shared-value'
  ```

### Patch Changes

- [#8536](https://github.com/graphql-hive/console/pull/8536)
  [`c9328ea`](https://github.com/graphql-hive/console/commit/c9328ea8d833b074c0bb607dc67d2d2fd35d7a50)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Upgrades composition library to
  `v0.27.0` - adds satisfiability checking for `@fromContext` arguments

## 0.64.1

### Patch Changes

- [#8530](https://github.com/graphql-hive/console/pull/8530)
  [`d427046`](https://github.com/graphql-hive/console/commit/d427046ca6f7a2d4ad5b3dee3c8bb4678b4da35f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update
  `@theguild/federation-composition` to `0.26.3`. Unresolvable `@requires`, `@key`, `@provides` and
  `@fromContext` selections are now reported as composition errors instead of throwing, so
  composition fails with a proper error message instead of crashing.

## 0.64.0

### Minor Changes

- [#8498](https://github.com/graphql-hive/console/pull/8498)
  [`995a5de`](https://github.com/graphql-hive/console/commit/995a5de801ad60071102114f457c1894730b88cd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `schema:publish --fail-on-composition-error` to
  prevent publishing a federation schema that would cause a composition error.

  Closes https://github.com/graphql-hive/console/issues/7588

- [#8489](https://github.com/graphql-hive/console/pull/8489)
  [`a2fef64`](https://github.com/graphql-hive/console/commit/a2fef64a482e6be6ea844c6a03b1ce62bed86ffb)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add custom HTTP headers to requests sent by the
  Hive CLI to the registry endpoint. This supports internal setups where the registry is available
  only through a proxy or gateway that requires additional authentication, tenant, routing, or
  network headers.

  For persistent configuration, add a `headers` object to the `registry` section of `hive.json`:

  ```json
  {
    "registry": {
      "endpoint": "https://hive.internal.example.com/graphql",
      "accessToken": "YOUR_HIVE_TOKEN",
      "headers": {
        "X-Internal-Proxy-Token": "YOUR_PROXY_TOKEN",
        "X-Tenant-ID": "engineering"
      }
    }
  }
  ```

  For one-off commands or CI environments, pass the repeatable `--registry.header` flag using
  `Name=Value` syntax:

  ```shell
  hive schema:check schema.graphql \
    --registry.header 'X-Internal-Proxy-Token=YOUR_PROXY_TOKEN' \
    --registry.header 'X-Tenant-ID=engineering'
  ```

  Headers supplied with `--registry.header` override headers with the same name from `hive.json`.
  The CLI-managed authorization and client identification headers cannot be overridden by custom
  headers.

### Patch Changes

- [#8490](https://github.com/graphql-hive/console/pull/8490)
  [`dbc26a5`](https://github.com/graphql-hive/console/commit/dbc26a5f88369ca83a54d1d0e50e7acac53a95dd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `schema:push` for uploading immutable named
  schema revisions without publishing them immediately. A pushed revision can later be published by
  passing `--revision` to `schema:publish` instead of retrieving the SDL from a file or GraphQL
  endpoint.

  Push and publish a monolith schema revision:

  ```sh
  hive schema:push schema.graphql \
    --target my-org/my-project/my-target \
    --revision "$REVISION"
  
  hive schema:publish \
    --target my-org/my-project/my-target \
    --revision "$REVISION"
  ```

  For a federated schema, provide the service when pushing:

  ```sh
  hive schema:push products.graphql \
    --target my-org/my-project/my-target \
    --service products \
    --revision "$REVISION"
  
  hive schema:publish \
    --target my-org/my-project/my-target \
    --service products \
    --url https://products.example.com/graphql \
    --revision "$REVISION"
  ```

  Revision names are immutable for a service within a project. Pushing different SDL with an
  existing revision fails with an error such as
  `Revision 'products@abc123' already exists with a different schema.` Attempting to publish an
  unknown revision reports `Schema revision 'abc123' was not found.`

## 0.63.2

### Patch Changes

- [#8464](https://github.com/graphql-hive/console/pull/8464)
  [`0d5b665`](https://github.com/graphql-hive/console/commit/0d5b6659c6bb2cd3ed92d6dbeb86f635ccc1dc7f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix federation contract composition attaching
  `@inaccessible` to `ContextFieldValue`.

- [#8460](https://github.com/graphql-hive/console/pull/8460)
  [`bba8d96`](https://github.com/graphql-hive/console/commit/bba8d9675e7d7a82276df95b2b35ed95d2654ab3)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Preserve types referenced by directive arguments in
  schema contracts and prevent `federation__ContextFieldValue` from leaking into composed
  supergraphs.

- Updated dependencies
  [[`cac2fc2`](https://github.com/graphql-hive/console/commit/cac2fc27162811ef0bc739f05793d273497d04ef)]:
  - @graphql-hive/core@0.22.5

## 0.63.1

### Patch Changes

- [#8427](https://github.com/graphql-hive/console/pull/8427)
  [`a613071`](https://github.com/graphql-hive/console/commit/a61307121bce5a2e4db3f34a2e057e1bbe98f0d4)
  Thanks [@jdolle](https://github.com/jdolle)! - Improve error handling for graphql requests

  Fixes an edge case where if the graphql error response doesn't include the extension, then an
  unexpected error was thrown. Additionally, if this error was thrown, then the error response was
  not logged even if the debug logs are enabled. This moves the debug log to before these conditions
  so that it is possible to always see the response in the logs.

## 0.63.0

### Minor Changes

- [#8407](https://github.com/graphql-hive/console/pull/8407)
  [`b27ac17`](https://github.com/graphql-hive/console/commit/b27ac171c7affa9d287f91fd2a79c2f2548da89f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add the `app:check` command.

  The `app:check` command can be used to verify whether persisted documents are valid against the
  latest target schema without having to create and upload the persisted documents to the schema
  registry.

  **Example Usage**

  ```sh
  hive app:check persisted-documents.json \
    --registry.accessToken "$HIVE_TOKEN" \
    --target the-guild/hive-console/production
  ```

### Patch Changes

- [#8421](https://github.com/graphql-hive/console/pull/8421)
  [`c970ddb`](https://github.com/graphql-hive/console/commit/c970ddbda4b73557830de2e955c96003418232dd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Updates
  `@theguild/federation-composition` to `v0.26.0`. Adds support for `@context` and `@fromContext`
  directives in Federation.

- Updated dependencies
  [[`85a3351`](https://github.com/graphql-hive/console/commit/85a33512ed9f03095d376fc586d737ac0183410d)]:
  - @graphql-hive/core@0.22.4

## 0.62.0

### Minor Changes

- [#8371](https://github.com/graphql-hive/console/pull/8371)
  [`48a7822`](https://github.com/graphql-hive/console/commit/48a7822f952e3f46877a8c49669d7fad61069d6c)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support uploading an Apollo persisted query
  manifest file with the `hive app:create` command.

- [#8327](https://github.com/graphql-hive/console/pull/8327)
  [`6c67f5f`](https://github.com/graphql-hive/console/commit/6c67f5f0751a223bbf4ef05b789d90973cb28075)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support providing a base schema when performaning a
  schema check. When providing a base schema the diff is generated based on the latest schema
  version composed with the provided base schema override for the service.

  This helps when running the `hive schema:check` command as part of a merge queue in order to avoid
  flagging breaking changes that have been approved in the context of a previous merge queue pull
  request failing the merge queue check.

  Use the `--baseline` CLI argument for referencing either a local file or a file within the Git
  history.

  ```sh
  hive schema:check \
    --target the-guild/hive-console/development \
    --baseline 43e728ea9:schema.graphqls \
    --service products \
    --contextId "hive-console#67" \
    schema.graphqls
  ```

  Example using the GitHub integration:

  ```sh
  hive schema:check \
    --target the-guild/hive-console/development \
    --baseline 43e728ea9:schema.graphqls \
    --service products \
    --github \
    schema.graphqls
  ```

## 0.61.5

### Patch Changes

- Updated dependencies
  [[`33791da`](https://github.com/graphql-hive/console/commit/33791da958f6801d4a981c9147891724f39ef50c)]:
  - @graphql-hive/core@0.22.3

## 0.61.4

### Patch Changes

- Updated dependencies
  [[`658ff6a`](https://github.com/graphql-hive/console/commit/658ff6a644ef76787d1d283a34eab56c03f8ffa5)]:
  - @graphql-hive/core@0.22.2

## 0.61.3

### Patch Changes

- Updated dependencies
  [[`3dbda7d`](https://github.com/graphql-hive/console/commit/3dbda7dbe895173578cc4c452a85ef6c2ce07383)]:
  - @graphql-hive/core@0.22.1

## 0.61.2

### Patch Changes

- [#8291](https://github.com/graphql-hive/console/pull/8291)
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Use npm trusted publishing.

- Updated dependencies
  [[`8270cac`](https://github.com/graphql-hive/console/commit/8270cac6516b20454914ee39d189e8c943487834),
  [`ee8af3e`](https://github.com/graphql-hive/console/commit/ee8af3edcb06f4d59b742cf2c8f2f99167bb52a0)]:
  - @graphql-hive/core@0.22.0

## 0.61.1

### Patch Changes

- [#8275](https://github.com/graphql-hive/console/pull/8275)
  [`e967f76`](https://github.com/graphql-hive/console/commit/e967f7681933b035c88ad9323dde17e9a372bd69)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade `@theguild/federation-composition` to
  support oneOf directive in public sdl

  https://github.com/graphql-hive/federation-composition/releases/tag/v0.23.3

## 0.61.0

### Minor Changes

- [#8230](https://github.com/graphql-hive/console/pull/8230)
  [`e7e26b6`](https://github.com/graphql-hive/console/commit/e7e26b6e6c2260cd60c09a56435742139ea73a77)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support retries for deleting a schema in case the
  registry is busy and locked.

## 0.60.3

### Patch Changes

- [#8228](https://github.com/graphql-hive/console/pull/8228)
  [`058c082`](https://github.com/graphql-hive/console/commit/058c08273c6aa24b0b0f3e7d4ff3d366869655e9)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade composition library to support oneOf
  directive without requiring composeDirective, and to fix an edge case where an external field is
  not flagged as external in the supergraph if another graph uses that field in the key

## 0.60.2

### Patch Changes

- [#8171](https://github.com/graphql-hive/console/pull/8171)
  [`277ce5c`](https://github.com/graphql-hive/console/commit/277ce5ced5c9c17769b43755ec12d27eb8550435)
  Thanks [@jdolle](https://github.com/jdolle)! - Print schema delete changes and errors. Do not
  require confirm on dry run deletes.

## 0.60.1

### Patch Changes

- [#8117](https://github.com/graphql-hive/console/pull/8117)
  [`e71896b`](https://github.com/graphql-hive/console/commit/e71896b13c744fd32a872cb74b9a95ff113cebbc)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Add `--publish` flag to `app:create` command
  to publish the app deployment immediately after creation

  Now `app:create` can immediately publish the created app deployment without needing to run
  `app:publish` separately.

  For example:

  ```bash
  hive app:create --name my-app --version 1.0.0 --publish ./operations.json
  ```

- [#8117](https://github.com/graphql-hive/console/pull/8117)
  [`e71896b`](https://github.com/graphql-hive/console/commit/e71896b13c744fd32a872cb74b9a95ff113cebbc)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - Make `--version` flag optional in
  `app:create` command

  When `--version` is not provided, a random 7-character alphanumeric version is generated and used
  for creating the app deployment.

  For example:

  ```bash
  hive app:create --name my-app ./operations.json
  ```

- [#8117](https://github.com/graphql-hive/console/pull/8117)
  [`e71896b`](https://github.com/graphql-hive/console/commit/e71896b13c744fd32a872cb74b9a95ff113cebbc)
  Thanks [@enisdenjo](https://github.com/enisdenjo)! - The `app:create` command now accepts a
  directory or a glob pattern in addition to a persisted operations JSON manifest

  When a directory or glob is provided, `app:create` scans for `*.graphql` files, normalizes each
  operation by collapsing whitespace, computes a SHA-256 hash per operation, and uses the resulting
  manifest directly without writing an intermediate file.

  ```bash
  # from a directory
  hive app:create --name my-app --version 1.0.0 ./src/operations
  
  # from a glob pattern
  hive app:create --name my-app --version 1.0.0 "./src/**/*.graphql"
  
  # from an existing manifest (unchanged behavior)
  hive app:create --name my-app --version 1.0.0 persisted-operations.json
  ```

- Updated dependencies
  [[`63a9126`](https://github.com/graphql-hive/console/commit/63a912691f0c7e5afdd2cc864de53df289592b54)]:
  - @graphql-hive/core@0.21.1

## 0.60.0

### Minor Changes

- [#8031](https://github.com/graphql-hive/console/pull/8031)
  [`51345a9`](https://github.com/graphql-hive/console/commit/51345a9c7487a7949a10b07d178836b02c7de197)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add support for promoting schema versions via the
  new `hive schema:promote` command.

### Patch Changes

- [#8064](https://github.com/graphql-hive/console/pull/8064)
  [`2b2339d`](https://github.com/graphql-hive/console/commit/2b2339d45f4ad5ffc111fd711a2904fcfb4bd64d)
  Thanks [@jdolle](https://github.com/jdolle)! - Extend Hive CLI timeout for schema:check from 20s
  to 55s to better align with the server's timeout

## 0.59.2

### Patch Changes

- [#8035](https://github.com/graphql-hive/console/pull/8035)
  [`0cd6cc5`](https://github.com/graphql-hive/console/commit/0cd6cc5606e8cf3c952583feec956c8f024ee615)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Address vulnerability
  [GHSA-rpmf-866q-6p89](https://github.com/advisories/GHSA-rpmf-866q-6p89)

## 0.59.1

### Patch Changes

- [#8018](https://github.com/graphql-hive/console/pull/8018)
  [`083a4a7`](https://github.com/graphql-hive/console/commit/083a4a7d9f17b5cc86483c5ce274ec0496bcfdc1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Correct fallback behavior for subgraph
  introspection. If subgraph introspection using graphql's standard introspection query fails, then
  it will fall back to Federation's Query.\_service query.

- [#8014](https://github.com/graphql-hive/console/pull/8014)
  [`32cdd14`](https://github.com/graphql-hive/console/commit/32cdd1474e510af21d5aa94029c3ad813e5baafd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Show correct error code (116) with origin service
  for failed introspection result.

## 0.59.0

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

- [#5853](https://github.com/graphql-hive/console/pull/5853)
  [`580918d`](https://github.com/graphql-hive/console/commit/580918de79e290279ae7be93ec7b065b47dff9bf)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support introspection of federated
  subgraph's schema in the `$ hive introspect` command.

  This change allows developers to extract the schema of a subgraph (GraphQL Federation) from a
  running service. It is useful if the GraphQL framework used in the subgraph does not emit the
  schema as `.graphqls` file during build.

  ***

  The CLI attempts to automatically detect whether the endpoint is a a GraphQL Federation, by
  checking whether the `_Service` type is accessible via introspection.

  If you want to either force Apollo Subgraph or GraphQL introspection you can do that via the
  `--type` flag.

  ```sh
  # Force GraphQL Introspection
  hive introspect --type graphql http://localhost:3000/graphql
  ```

  ```sh
  # Force GraphQL Federation Introspection
  hive introspect --type federation http://localhost:3000/graphql
  ```

  The federation introspection requires the introspected GraphQL API is capable of resolving the
  following two queries:

  - **`{ __type(name: "_Service") { name } }`** for looking up whether the GraphQL service is a
    Federation subgraph
  - **`{ _service { sdl } }`** for retrieving the subgraph SDL

## 0.58.5

### Patch Changes

- [#7797](https://github.com/graphql-hive/console/pull/7797)
  [`bb74982`](https://github.com/graphql-hive/console/commit/bb74982825d3f7d31c6d6345cf586617cbe728e8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Revert improvements around federation composition
  rules introduced in `0.58.4` as it might cause issues for Apollo Gateway.

## 0.58.4

### Patch Changes

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

- Updated dependencies
  [[`ee2785c`](https://github.com/graphql-hive/console/commit/ee2785c4cc63922bbd45f2557cc6d1e5577c6cca)]:
  - @graphql-hive/core@0.21.0

## 0.58.3

### Patch Changes

- [#7712](https://github.com/graphql-hive/console/pull/7712)
  [`a95deb7`](https://github.com/graphql-hive/console/commit/a95deb75632ae63cb812731f914000e75c010ea8)
  Thanks [@jdolle](https://github.com/jdolle)! - Replace custom regex logic that stripped all spaces
  on publish. Use graphqljs' stripIgnoredCharacters function instead. This maintains the useful
  spacing in multiline descriptions while stripping out other unnecessary characters

## 0.58.2

### Patch Changes

- [#7707](https://github.com/graphql-hive/console/pull/7707)
  [`4d36f7a`](https://github.com/graphql-hive/console/commit/4d36f7aeb06a911d844b74b9f556e11f353771a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix schema SDL becoming invalid through
  minification.

## 0.58.1

### Patch Changes

- [#7664](https://github.com/graphql-hive/console/pull/7664)
  [`ddea09b`](https://github.com/graphql-hive/console/commit/ddea09bbc34f5486fa6ddddf4e60a899fc7f43b5)
  Thanks [@jdolle](https://github.com/jdolle)! - Do not minify multiline descriptions in SDL on
  check/push

## 0.58.0

### Minor Changes

- [#7432](https://github.com/graphql-hive/console/pull/7432)
  [`f8e49ae`](https://github.com/graphql-hive/console/commit/f8e49ae53f743a50e104fba216bd4545fb4abdd6)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - Add app deployment retirement
  protection settings. When enabled, prevents retiring app deployments that were recently created or
  are still actively used, based on configurable inactivity period, creation age, and traffic
  thresholds.

## 0.57.4

### Patch Changes

- Updated dependencies
  [[`1f824a7`](https://github.com/graphql-hive/console/commit/1f824a7d503c39d8675fb44e899da275d5ac7045)]:
  - @graphql-hive/core@0.20.2

## 0.57.3

### Patch Changes

- Updated dependencies
  [[`8bbbfb8`](https://github.com/graphql-hive/console/commit/8bbbfb8aa6aa4c59b9ad515dfbbe12616931f82d)]:
  - @graphql-hive/core@0.20.1

## 0.57.2

### Patch Changes

- [#7485](https://github.com/graphql-hive/console/pull/7485)
  [`e3006e2`](https://github.com/graphql-hive/console/commit/e3006e22bbe38e673c27b94b080be5f57f3d095d)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fixes a bug in Federation composition
  and validation where an error was incorrectly reported for interfaces implementing another
  interface with a `@key`. The validation now correctly applies only to object types implementing
  the interface.

## 0.57.1

### Patch Changes

- Updated dependencies
  [[`60133a4`](https://github.com/graphql-hive/console/commit/60133a41a684a0c1b1a45d47cf3cd30cc804c19d)]:
  - @graphql-hive/core@0.20.0

## 0.57.0

### Minor Changes

- [#6836](https://github.com/graphql-hive/console/pull/6836)
  [`128ce1b`](https://github.com/graphql-hive/console/commit/128ce1bdf26c07f7bfe7a598951562df6471bb73)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

### Patch Changes

- Updated dependencies
  [[`711f4e6`](https://github.com/graphql-hive/console/commit/711f4e6a25ea7806d871554f2949a9ff300a0dbf),
  [`4f9f988`](https://github.com/graphql-hive/console/commit/4f9f988d62c54f6e7a6820eba1fa9913146dcf9e)]:
  - @graphql-hive/core@0.19.0

## 0.56.0

### Minor Changes

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

### Patch Changes

- [#7346](https://github.com/graphql-hive/console/pull/7346)
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fixes an issue where schema changes containing
  escaped single-quoted strings were not handled correctly.

- Updated dependencies
  [[`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d),
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d),
  [`f266368`](https://github.com/graphql-hive/console/commit/f26636891b8b7e00b9a7823e9d584cedd9dd0f2d)]:
  - @graphql-hive/core@0.18.0

## 0.55.1

### Patch Changes

- Updated dependencies
  [[`a6f707b`](https://github.com/graphql-hive/console/commit/a6f707b50d0950198a3121019a6aff5ddf01c5f3),
  [`a6f707b`](https://github.com/graphql-hive/console/commit/a6f707b50d0950198a3121019a6aff5ddf01c5f3)]:
  - @graphql-hive/core@0.17.0

## 0.55.0

### Minor Changes

- [#7267](https://github.com/graphql-hive/console/pull/7267)
  [`114cd80`](https://github.com/graphql-hive/console/commit/114cd80a8e419d6ff631631fee28a9922a7b9e5a)
  Thanks [@jdolle](https://github.com/jdolle)! - Upgrade graphql-inspector/core to v7 and update the
  models to be able to handle the new change objects. GraphQL Inspector now supports directive
  changes and improves the accuracy of the severity level for several change types. This will
  improve schema checks to make them more accurate and more complete. See graphql-inspector's
  changelog for details.

### Patch Changes

- [#7321](https://github.com/graphql-hive/console/pull/7321)
  [`316859e`](https://github.com/graphql-hive/console/commit/316859ebcb29108efc30de515276a39a1161d124)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - handle escaped single-quoted strings
  in schema changes

- Updated dependencies
  [[`5229612`](https://github.com/graphql-hive/console/commit/5229612d4fd17ed2535ed8d66160758103d2c00f)]:
  - @graphql-hive/core@0.16.0

## 0.54.0

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

## 0.53.5

### Patch Changes

- Updated dependencies
  [[`64c8368`](https://github.com/graphql-hive/console/commit/64c8368c4b94b4ad2178d341442f0a0ffb4013f1)]:
  - @graphql-hive/core@0.15.1

## 0.53.4

### Patch Changes

- Updated dependencies
  [[`2cc443c`](https://github.com/graphql-hive/console/commit/2cc443c160e11313c905424b63a7c1362121d8d8)]:
  - @graphql-hive/core@0.15.0

## 0.53.3

### Patch Changes

- [#7264](https://github.com/graphql-hive/console/pull/7264)
  [`582bc0e`](https://github.com/graphql-hive/console/commit/582bc0e2a4a95d0023d1cdbe627bc6147f82af8e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Ensure http debug logs are printed properly.

- Updated dependencies
  [[`582bc0e`](https://github.com/graphql-hive/console/commit/582bc0e2a4a95d0023d1cdbe627bc6147f82af8e)]:
  - @graphql-hive/core@0.14.0

## 0.53.2

### Patch Changes

- Updated dependencies
  [[`43920cd`](https://github.com/graphql-hive/console/commit/43920cdb3d56a54c66c61bbc6ca1cc6af4a7b5ee),
  [`43920cd`](https://github.com/graphql-hive/console/commit/43920cdb3d56a54c66c61bbc6ca1cc6af4a7b5ee)]:
  - @graphql-hive/core@0.13.2

## 0.53.1

### Patch Changes

- Updated dependencies
  [[`d8f6e25`](https://github.com/graphql-hive/console/commit/d8f6e252ee3cd22948eb0d64b9d25c9b04dba47c)]:
  - @graphql-hive/core@0.13.1

## 0.53.0

### Minor Changes

- [#7206](https://github.com/graphql-hive/console/pull/7206)
  [`01963a0`](https://github.com/graphql-hive/console/commit/01963a089968f6d956c9dbc7d090dd6dc907c305)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve output of the `hive whoami` command. It now
  also handles the new access token format.

## 0.52.1

### Patch Changes

- [#7193](https://github.com/graphql-hive/console/pull/7193)
  [`543de17`](https://github.com/graphql-hive/console/commit/543de174f5cb8caa46b8e833d13e1831c7ffbfa9)
  Thanks [@adambenhassen](https://github.com/adambenhassen)! - `schema:check --forceSafe` now
  properly approves breaking schema changes in Hive (requires write permission registry token)

## 0.52.0

### Minor Changes

- [#7155](https://github.com/graphql-hive/console/pull/7155)
  [`caebbe0`](https://github.com/graphql-hive/console/commit/caebbe093a997022691276e0dc67ce9ab8589112)
  Thanks [@jdolle](https://github.com/jdolle)! - add schemaVersionByCommit; update docs and cli; fix
  webhook commit reference

## 0.51.0

### Minor Changes

- [#7100](https://github.com/graphql-hive/console/pull/7100)
  [`2cbdced`](https://github.com/graphql-hive/console/commit/2cbdcedb79cfbe225dbdafe6122cdc12305d5aaf)
  Thanks [@XiNiHa](https://github.com/XiNiHa)! - add `hive app:retire` command for retiring an app
  deployment

## 0.50.5

### Patch Changes

- [#7046](https://github.com/graphql-hive/console/pull/7046)
  [`8c49615`](https://github.com/graphql-hive/console/commit/8c4961549f265946edcf744c6180b76b2217c4a3)
  Thanks [@jdolle](https://github.com/jdolle)! - Add progress log to app:create

## 0.50.4

### Patch Changes

- [#6919](https://github.com/graphql-hive/console/pull/6919)
  [`49187c9`](https://github.com/graphql-hive/console/commit/49187c972e220a48993ecf5d5ce11dccd3b73727)
  Thanks [@jdolle](https://github.com/jdolle)! - fix fallback when hive.json is used but does not
  provide the requested value

## 0.50.3

### Patch Changes

- Updated dependencies
  [[`8d56b98`](https://github.com/graphql-hive/console/commit/8d56b9848028d65442cb1dada139f5a17d464f1b)]:
  - @graphql-hive/core@0.13.0

## 0.50.2

### Patch Changes

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

## 0.50.1

### Patch Changes

- Updated dependencies
  [[`bbd5643`](https://github.com/graphql-hive/console/commit/bbd5643924eb2b32511e96a03a3a5a978a66adee)]:
  - @graphql-hive/core@0.12.0

## 0.50.0

### Minor Changes

- [#6658](https://github.com/graphql-hive/console/pull/6658)
  [`e6a970f`](https://github.com/graphql-hive/console/commit/e6a970f790b388ff29f97709acdd73136a79dfb7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Internal adjustments for using non-deprecated API
  fields.

- [#6626](https://github.com/graphql-hive/console/pull/6626)
  [`2056307`](https://github.com/graphql-hive/console/commit/20563078449dbb6bf33bac3b2e5ac3d2c772fc6f)
  Thanks [@jdolle](https://github.com/jdolle)! - Show dangerous changes as a separate list in
  schema:check

- [#6662](https://github.com/graphql-hive/console/pull/6662)
  [`2b220a5`](https://github.com/graphql-hive/console/commit/2b220a560c4e4777a20ec0cf5f6ee68032055022)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support federation composition validation for
  `IMPLEMENTED_BY_INACCESSIBLE`.

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

### Patch Changes

- [#6768](https://github.com/graphql-hive/console/pull/6768)
  [`5ee3a2e`](https://github.com/graphql-hive/console/commit/5ee3a2e98c1de16d61b4a610123b5e7dbeb13304)
  Thanks [@jdolle](https://github.com/jdolle)! - Correct error exit codes

- Updated dependencies
  [[`5130fc1`](https://github.com/graphql-hive/console/commit/5130fc1db8c50ac0eb35d901623594749772c550)]:
  - @graphql-hive/core@0.11.0

## 0.49.1

### Patch Changes

- [#6633](https://github.com/graphql-hive/console/pull/6633)
  [`a5e00f2`](https://github.com/graphql-hive/console/commit/a5e00f260a6f21b3207fc8257c302e68a0d671b1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fix Federation composition error when having an
  inaccessible default value on an inaccessible field.

- [#6585](https://github.com/graphql-hive/console/pull/6585)
  [`c0d9ca3`](https://github.com/graphql-hive/console/commit/c0d9ca30d4c360e75be7902d2693303ffe622975)
  Thanks [@jdolle](https://github.com/jdolle)! - Restrict new service names to 64 characters,
  alphanumberic, `_` and `-`.

- Updated dependencies
  [[`ee70018`](https://github.com/graphql-hive/console/commit/ee7001883970fac81210ec21ce70a72bfd3b67bb),
  [`a003f78`](https://github.com/graphql-hive/console/commit/a003f781cb1a38d8b00a3256163c50e3893db5f2)]:
  - @graphql-hive/core@0.10.1

## 0.49.0

### Minor Changes

- [#6573](https://github.com/graphql-hive/console/pull/6573)
  [`3bf0598`](https://github.com/graphql-hive/console/commit/3bf05980759d90a9ab80aeb05a8fb0646af1b451)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Better error handling for missing `--target` option
  when required.

### Patch Changes

- [#6582](https://github.com/graphql-hive/console/pull/6582)
  [`bb2f2aa`](https://github.com/graphql-hive/console/commit/bb2f2aa30f6cd4a5427e7d977c816d7e78499ea2)
  Thanks [@jdolle](https://github.com/jdolle)! - Adds optional url argument to schema checks

- Updated dependencies
  [[`494697e`](https://github.com/graphql-hive/console/commit/494697e20f67ef877cd5dd63ccd29984c719ab44)]:
  - @graphql-hive/core@0.10.0

## 0.48.3

### Patch Changes

- [#6508](https://github.com/graphql-hive/console/pull/6508)
  [`716868b`](https://github.com/graphql-hive/console/commit/716868bae607f8ee0a800ade060010b2c9e144aa)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - No changes in this version

## 0.48.2

### Patch Changes

- [#6502](https://github.com/graphql-hive/console/pull/6502)
  [`cef7fd8`](https://github.com/graphql-hive/console/commit/cef7fd88e4929942bcaf07aaf3bc226c5d9a38cd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - **hive dev**

  Update @theguild/federation-composition to 0.14.4:

  - Fix a child data type field not being accessible via interfaceObject
  - Respect inaccessible enum values while creating the public schema from the supergraph AST

## 0.48.1

### Patch Changes

- Updated dependencies
  [[`ae2d16d`](https://github.com/graphql-hive/console/commit/ae2d16d553e264c813ac65d78eacab3d7a2efeae)]:
  - @graphql-hive/core@0.9.1

## 0.48.0

### Minor Changes

- [#6488](https://github.com/graphql-hive/console/pull/6488)
  [`f7d65fe`](https://github.com/graphql-hive/console/commit/f7d65feb5aaf4f4f86dfc0fe5df3ea4c3df1d7a8)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Include and log a `x-request-id` header for all
  requests sent to the Hive API. This helps users to share more context with Hive staff when
  encountering errors.

### Patch Changes

- [#6483](https://github.com/graphql-hive/console/pull/6483)
  [`39eac03`](https://github.com/graphql-hive/console/commit/39eac0315c8ecb4fb55364d62c300f34dd5fdcab)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Show correct error message when attempting a schema
  check on a federation project without the `--service` paramater.
- Updated dependencies
  [[`f7d65fe`](https://github.com/graphql-hive/console/commit/f7d65feb5aaf4f4f86dfc0fe5df3ea4c3df1d7a8)]:
  - @graphql-hive/core@0.9.0

## 0.47.0

### Minor Changes

- [#6449](https://github.com/graphql-hive/console/pull/6449)
  [`0504530`](https://github.com/graphql-hive/console/commit/05045306b789e97ec39cbd2c8ee2b4f1b721dc9e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add `--target` flag for commands `app:create`,
  `app:publish`, `operations:check`, `schema:check`, `schema:delete`, `schema:fetch`,
  `schema:publish` and `dev`.

  The `--target` flag can be used to specify the target on which the operation should be performed.
  Either a slug or ID of the target can be provided.

  A provided slug must follow the format `$organizationSlug/$projectSlug/$targetSlug` (e.g.
  `the-guild/graphql-hive/staging`).

  **Example using target slug**

  ```bash
  hive schema:publish --target the-guild/graphql-hive/production ./my-schema.graphql
  ```

  A target id, must be a valid target UUID.

  **Example using target id**

  ```bash
  hive schema:publish --target a0f4c605-6541-4350-8cfe-b31f21a4bf80 ./my-schema.graphql
  ```

  **Note:** We encourage starting to use the `--target` flag today. In the future the flag will
  become mandatory as we are moving to a more flexible approach of access tokens that can be granted
  access to multiple targets.

## 0.46.1

### Patch Changes

- [#6380](https://github.com/graphql-hive/console/pull/6380)
  [`40213fb`](https://github.com/graphql-hive/console/commit/40213fb7dc39cfb2688e6127e8fe2658f7fceb7f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update
  `@theguild/federation-composition` to
  [v0.14.3](https://github.com/the-guild-org/federation/releases/tag/v0.14.3)

- Updated dependencies
  [[`ec356a7`](https://github.com/graphql-hive/console/commit/ec356a7784d1f59722f80a69f501f1f250b2f6b2)]:
  - @graphql-hive/core@0.8.4

## 0.46.0

### Minor Changes

- [#6357](https://github.com/graphql-hive/console/pull/6357)
  [`e10cc2d`](https://github.com/graphql-hive/console/commit/e10cc2db4297dafabbbf4996d501384dd0884c4a)
  Thanks [@jasonkuhrt](https://github.com/jasonkuhrt)! - Add experimental json file flag to command
  `schema:check`.

  On the `schema:check` command, you can now use the flag
  `--experimental-json-file ./path/to/schema-check-result.json` to output a JSON file containing the
  command's result.

  This experimental feature is designed to help you with scripting, typically in CI/CD pipelines.

  Please note that this is an experimental feature, and therefore is:

  1. likely to change or be removed in a future version
  2. not covered by semantic versioning.

- [#6338](https://github.com/graphql-hive/console/pull/6338)
  [`f6565fc`](https://github.com/graphql-hive/console/commit/f6565fc8996922bfd657e83a8b53b8b473858154)
  Thanks [@jdolle](https://github.com/jdolle)! - cli schema:fetch targets latest if actionId
  argument is missing

- [#6333](https://github.com/graphql-hive/console/pull/6333)
  [`0a84187`](https://github.com/graphql-hive/console/commit/0a84187051ae121f06bacc6b99da96d81e775dcd)
  Thanks [@jasonkuhrt](https://github.com/jasonkuhrt)! - BREAKING: Remove config commands

  This prepares for the addition of JSON format output in other commands.

## 0.45.0

### Minor Changes

- [#6255](https://github.com/graphql-hive/console/pull/6255)
  [`29c45df`](https://github.com/graphql-hive/console/commit/29c45dfbfc8ab87e9e84fec9c8def41ba01c3fe8)
  Thanks [@jdolle](https://github.com/jdolle)! - Added subgraph type to schema:fetch cmd to print
  subgraph details

### Patch Changes

- [#6252](https://github.com/graphql-hive/console/pull/6252)
  [`5a6e565`](https://github.com/graphql-hive/console/commit/5a6e565be464983a5651a1349470415d3d93ba46)
  Thanks [@jdolle](https://github.com/jdolle)! - Print a detailed error when a command is executed
  without a hive access token

- Updated dependencies
  [[`039c66b`](https://github.com/graphql-hive/console/commit/039c66bd24d4339e56b4e1e1fc7f8fa68de7e954)]:
  - @graphql-hive/core@0.8.3

## 0.44.5

### Patch Changes

- [#6224](https://github.com/graphql-hive/console/pull/6224)
  [`592d3b3`](https://github.com/graphql-hive/console/commit/592d3b34551e27bf0d0993609ad0ad2d7ea7104c)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Extends debug information. Prints a
  list of files of the script directory and a path of included node binary. To enable debug mode,
  pass DEBUG=1 environment variable when running the CLI.

## 0.44.4

### Patch Changes

- [#6057](https://github.com/graphql-hive/console/pull/6057)
  [`e4f8b0a`](https://github.com/graphql-hive/console/commit/e4f8b0a51d1158da966a719f321bc13e5af39ea0)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Explain what Hive is in README

## 0.44.3

### Patch Changes

- [#5872](https://github.com/graphql-hive/platform/pull/5872)
  [`580d349`](https://github.com/graphql-hive/platform/commit/580d349d45b85dc6103b39c6e07bc3d81e5d3bc9)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump @theguild/federation-composition
  to v0.14.1

## 0.44.2

### Patch Changes

- Updated dependencies
  [[`c728803`](https://github.com/graphql-hive/platform/commit/c7288038f24c0214b4023994f306c6229c1ce72c)]:
  - @graphql-hive/core@0.8.2

## 0.44.1

### Patch Changes

- Updated dependencies
  [[`be5d39c`](https://github.com/kamilkisiela/graphql-hive/commit/be5d39cbf08d0681d142e83a708d300abc504c44)]:
  - @graphql-hive/core@0.8.1

## 0.44.0

### Minor Changes

- [#5661](https://github.com/kamilkisiela/graphql-hive/pull/5661)
  [`ed25aca`](https://github.com/kamilkisiela/graphql-hive/commit/ed25aca53a0c064adf50d13b0aa3407028d72049)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Improve error output for rejected app deployment
  creation. The CLI now shows which operation is affected and the reason for the failed upload.

## 0.43.0

### Minor Changes

- [#5474](https://github.com/kamilkisiela/graphql-hive/pull/5474)
  [`3850ad2`](https://github.com/kamilkisiela/graphql-hive/commit/3850ad24d421631a56676cc1bff5d0c4a3d28a49)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce schema publish retries, when being
  blocked by other concurrent schema publishes.

## 0.42.1

### Patch Changes

- Updated dependencies
  [[`3ffdb6e`](https://github.com/kamilkisiela/graphql-hive/commit/3ffdb6e9466deb3c3aa09eea1445fc4caf698fd5)]:
  - @graphql-hive/core@0.8.0

## 0.42.0

### Minor Changes

- [#5190](https://github.com/kamilkisiela/graphql-hive/pull/5190)
  [`7039d83`](https://github.com/kamilkisiela/graphql-hive/commit/7039d83b943c05fbb289f391ff9be0ae0da720f1)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - add support for app deployments

### Patch Changes

- Updated dependencies
  [[`a896642`](https://github.com/kamilkisiela/graphql-hive/commit/a896642197e6d7779ba7ed71f365dfbd80532282)]:
  - @graphql-hive/core@0.7.1

## 0.41.0

### Minor Changes

- [#5307](https://github.com/kamilkisiela/graphql-hive/pull/5307)
  [`0a3b24d`](https://github.com/kamilkisiela/graphql-hive/commit/0a3b24d400770c2cc84642959febb9288ad1c1b7)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Re-introduce retry logging removed in previous
  release.

### Patch Changes

- Updated dependencies
  [[`3f03e7b`](https://github.com/kamilkisiela/graphql-hive/commit/3f03e7b3a65707ba8aa04335684f0aa8d261868f),
  [`0a3b24d`](https://github.com/kamilkisiela/graphql-hive/commit/0a3b24d400770c2cc84642959febb9288ad1c1b7)]:
  - @graphql-hive/core@0.7.0

## 0.40.1

### Patch Changes

- [#5304](https://github.com/kamilkisiela/graphql-hive/pull/5304)
  [`f2fef08`](https://github.com/kamilkisiela/graphql-hive/commit/f2fef08e9d1e13cb4a89d3882922db6dc822542e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fixed a logging issue where both
  initiated requests and successful responses were being recorded. This was causing the logs to be
  filled with unnecessary information and affected `hive artifact:fetch --artifact` command.

- Updated dependencies
  [[`f2fef08`](https://github.com/kamilkisiela/graphql-hive/commit/f2fef08e9d1e13cb4a89d3882922db6dc822542e)]:
  - @graphql-hive/core@0.6.1

## 0.40.0

### Minor Changes

- [#5234](https://github.com/kamilkisiela/graphql-hive/pull/5234)
  [`e6dc5c9`](https://github.com/kamilkisiela/graphql-hive/commit/e6dc5c9df34c30c52555b27b0bca50e0be75480b)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Provide debug logging for HTTP requests when
  providing the `--debug` flag.

### Patch Changes

- Updated dependencies
  [[`e6dc5c9`](https://github.com/kamilkisiela/graphql-hive/commit/e6dc5c9df34c30c52555b27b0bca50e0be75480b)]:
  - @graphql-hive/core@0.6.0

## 0.39.0

### Minor Changes

- [#5237](https://github.com/kamilkisiela/graphql-hive/pull/5237)
  [`c20907b`](https://github.com/kamilkisiela/graphql-hive/commit/c20907b7bf04a0289370e104f5c00371b71813a3)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Changes the default behavior of
  `hive dev` command. Now schema composition is done locally, without substituting subgraphs
  available in the registry.

  We added `--remote` flag to the `hive dev` command to mimic the previous behavior.

  **Breaking Change** The `$ hive dev` command is still a work in progress (as stated in the command
  description). That's why we are not considering this a breaking change, but a minor change.

  **_Before:_**

  The `hive dev` command would substitute subgraphs available in the registry with their local
  counterparts, performing schema composition over the network according to your project's
  configuration.

  **_After:_**

  The `hive dev` command will now perform schema composition locally, without substituting subgraphs
  available in the registry. This is the default behavior.

  To mimic the previous behavior, you can apply the `--remote` flag and continue using the command
  as before.

## 0.38.5

### Patch Changes

- Updated dependencies
  [[`f1e43c6`](https://github.com/kamilkisiela/graphql-hive/commit/f1e43c641f3ebac931839c7dfbdcb3a885167562)]:
  - @graphql-hive/core@0.5.0

## 0.38.4

### Patch Changes

- [#5097](https://github.com/kamilkisiela/graphql-hive/pull/5097)
  [`b8998e7`](https://github.com/kamilkisiela/graphql-hive/commit/b8998e7ead84a2714d13678aaf1e349e648eb90a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Retry up to 3 times a GET request in
  the artifact:fetch command

- Updated dependencies
  [[`b8998e7`](https://github.com/kamilkisiela/graphql-hive/commit/b8998e7ead84a2714d13678aaf1e349e648eb90a)]:
  - @graphql-hive/core@0.4.0

## 0.38.3

### Patch Changes

- Updated dependencies
  [[`cbc8364`](https://github.com/kamilkisiela/graphql-hive/commit/cbc836488b4acfb618fd877005ecf0126f1706b6)]:
  - @graphql-hive/core@0.3.1

## 0.38.2

### Patch Changes

- [#4814](https://github.com/kamilkisiela/graphql-hive/pull/4814)
  [`15a8c54`](https://github.com/kamilkisiela/graphql-hive/commit/15a8c548dbdf71b825a804d59b88b4a2e7dbf765)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - No changes

## 0.38.1

### Patch Changes

- [#4812](https://github.com/kamilkisiela/graphql-hive/pull/4812)
  [`8497c2e`](https://github.com/kamilkisiela/graphql-hive/commit/8497c2e3f57359816059839f58ba6f4cfdad210f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - No changes

## 0.38.0

### Minor Changes

- [#4807](https://github.com/kamilkisiela/graphql-hive/pull/4807)
  [`44b80b2`](https://github.com/kamilkisiela/graphql-hive/commit/44b80b27ab9f0eef85f6454e34e079e98ee0f2bd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Upgrade to Oclif v3

## 0.37.0

### Minor Changes

- [#4494](https://github.com/kamilkisiela/graphql-hive/pull/4494)
  [`c5eeac5`](https://github.com/kamilkisiela/graphql-hive/commit/c5eeac5ccef9e2dcc3c8bb33deec0fb95af9552e)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - 🚨 BREAKING CHANGE 🚨 Requires now Node
  v16+

### Patch Changes

- Updated dependencies
  [[`06d465e`](https://github.com/kamilkisiela/graphql-hive/commit/06d465e882b569b6d0dbd5b271d2d98aafaec0b1),
  [`c5eeac5`](https://github.com/kamilkisiela/graphql-hive/commit/c5eeac5ccef9e2dcc3c8bb33deec0fb95af9552e)]:
  - @graphql-hive/core@0.3.0

## 0.36.0

### Minor Changes

- [#4519](https://github.com/kamilkisiela/graphql-hive/pull/4519)
  [`08d8706`](https://github.com/kamilkisiela/graphql-hive/commit/08d87069541543d81a4ca59c7dd2091fce357790)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - No longer show dangerous changes

## 0.35.0

### Minor Changes

- [#4383](https://github.com/kamilkisiela/graphql-hive/pull/4383)
  [`ff480e9`](https://github.com/kamilkisiela/graphql-hive/commit/ff480e917337b3dd0c7eb3a51254ca2bac8bddcd)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Introducing `hive dev` command -
  compose local subgraphs with subgraphs from the registry.

## 0.34.1

### Patch Changes

- [#4328](https://github.com/kamilkisiela/graphql-hive/pull/4328)
  [`bb0ff23`](https://github.com/kamilkisiela/graphql-hive/commit/bb0ff238ee7a413aca618b05cdf2187e6b886188)
  Thanks [@Hebilicious](https://github.com/Hebilicious)! - Use node specifier for crypto import

- Updated dependencies
  [[`bb0ff23`](https://github.com/kamilkisiela/graphql-hive/commit/bb0ff238ee7a413aca618b05cdf2187e6b886188)]:
  - @graphql-hive/core@0.2.4

## 0.34.0

### Minor Changes

- [#3504](https://github.com/kamilkisiela/graphql-hive/pull/3504)
  [`cd12710`](https://github.com/kamilkisiela/graphql-hive/commit/cd1271088a321545fe8884658fd2c19649c3a4f6)
  Thanks [@beerose](https://github.com/beerose)! - Show which breaking changes are safe on usage

## 0.33.1

### Patch Changes

- [#3862](https://github.com/kamilkisiela/graphql-hive/pull/3862)
  [`02f5274`](https://github.com/kamilkisiela/graphql-hive/commit/02f52748508dfe70eb8ec500a442bfc5aecba34e)
  Thanks [@kongMina](https://github.com/kongMina)! - Separated schema check changes in CLI output

## 0.33.0

### Minor Changes

- [#3543](https://github.com/kamilkisiela/graphql-hive/pull/3543)
  [`6895ee3`](https://github.com/kamilkisiela/graphql-hive/commit/6895ee3ebf6a18c246b2f974f2cbb338887c97e7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support Apollo Client directives in
  operations:check command (pass --apolloClient flag)

## 0.32.1

### Patch Changes

- [#3529](https://github.com/kamilkisiela/graphql-hive/pull/3529)
  [`1615ad4`](https://github.com/kamilkisiela/graphql-hive/commit/1615ad4fb681e617d1ac217a3e96484c4f4ca89f)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - fix: use Hive Cloud as a default value
  for registry.endpoint

## 0.32.0

### Minor Changes

- [`00520b9`](https://github.com/kamilkisiela/graphql-hive/commit/00520b9c3eaa028241bee8b3202ebc07a82cdf5f)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Print warning when pull request number can not be
  resolved.

## 0.31.0

### Minor Changes

- [#3359](https://github.com/kamilkisiela/graphql-hive/pull/3359)
  [`21d246d`](https://github.com/kamilkisiela/graphql-hive/commit/21d246d815c63f4892f0490cff81b1c25c5f1d32)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Associate schema checks with context ID for
  remembering approved breaking schema changes for subsequent schema checks when running the
  `schema:check` command.

  If you are using the `--github` flag, all you need to do is to upgrade to this version. The
  `context` will be automatically be the pull request scope.

  On pull request branch GitHub Action:

  ```bash
  hive schema:check --github ./my-schema.graphql
  ```

  If you are not using GitHub Repositories and Actions, you can manually provide a context ID with
  the `--contextId` flag.

  ```bash
  hive schema:check --contextId "pull-request-69" ./my-schema.graphql
  ```

  [Learn more in the product update.](https://the-guild.dev/graphql/hive/product-updates/2023-11-16-schema-check-breaking-change-approval-context)

## 0.30.4

### Patch Changes

- [#1716](https://github.com/kamilkisiela/graphql-hive/pull/1716)
  [`f79fcf2`](https://github.com/kamilkisiela/graphql-hive/commit/f79fcf27d624350a52de6599677d46adb52ea835)
  Thanks [@dimaMachina](https://github.com/dimaMachina)! - Drop `graphql-request` dependency

## 0.30.3

### Patch Changes

- [#3240](https://github.com/kamilkisiela/graphql-hive/pull/3240)
  [`6b7aef8b`](https://github.com/kamilkisiela/graphql-hive/commit/6b7aef8b708690c5b5944c567b25210672325678)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Remove `Access to operation:publish`
  information from CLI command "whoami" (unused)

## 0.30.2

### Patch Changes

- [#3045](https://github.com/kamilkisiela/graphql-hive/pull/3045)
  [`925b943e`](https://github.com/kamilkisiela/graphql-hive/commit/925b943e4ae2ca79cde45acc8c723cb9b51caa7a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix [: /bin: unexpected operator on
  POSIX

## 0.30.1

### Patch Changes

- [#3042](https://github.com/kamilkisiela/graphql-hive/pull/3042)
  [`eeaec3fb`](https://github.com/kamilkisiela/graphql-hive/commit/eeaec3fb0fc9b7e86ed44437726481a8b61d688d)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix command != not found

## 0.30.0

### Minor Changes

- [#2701](https://github.com/kamilkisiela/graphql-hive/pull/2701)
  [`fdf71a1c`](https://github.com/kamilkisiela/graphql-hive/commit/fdf71a1c8cd100434960fb044264465db4704efd)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support forwarding GitHub repository information
  for schema checks and schema publishes when using the `--github` flag.

  Please upgrade if you want to correctly forward the information for (federated) subgraphs to the
  Hive registry.

## 0.29.0

### Minor Changes

- [#2569](https://github.com/kamilkisiela/graphql-hive/pull/2569)
  [`5bef13b`](https://github.com/kamilkisiela/graphql-hive/commit/5bef13b15e05b639c76ea7d847045d017a12c8a7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add ability to identify non-standard
  template litarls in operations:check command

## 0.28.0

### Minor Changes

- [#2720](https://github.com/kamilkisiela/graphql-hive/pull/2720)
  [`79227f8`](https://github.com/kamilkisiela/graphql-hive/commit/79227f86bd7c03730cd752a8ecdcefca2f714c2e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Fetch a specific schema sdl or supergraph from the
  API using the action id (commit sha) with the `hive schema:fetch` command.

  Example:

  ```bash
  hive schema:fetch 99dad865e1d710b359049f52be0b018 -T supergraph -W supergraph.graphql
  ```

## 0.27.1

### Patch Changes

- [#2723](https://github.com/kamilkisiela/graphql-hive/pull/2723)
  [`2a13ed4`](https://github.com/kamilkisiela/graphql-hive/commit/2a13ed498a46f6647bfbc7d583bcb75ddf81a774)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Add missing exit(1)

- [#2723](https://github.com/kamilkisiela/graphql-hive/pull/2723)
  [`2a13ed4`](https://github.com/kamilkisiela/graphql-hive/commit/2a13ed498a46f6647bfbc7d583bcb75ddf81a774)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Fix empty error list when running
  operations:check command (cause of the issue: GraphQL Inspector returns both errors and
  deprecation warnings)

## 0.27.0

### Minor Changes

- [#2697](https://github.com/kamilkisiela/graphql-hive/pull/2697)
  [`0475ca9`](https://github.com/kamilkisiela/graphql-hive/commit/0475ca9ea8d5b317c7764a5d666eaf3d7f36a3e1)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds introspect command

## 0.26.0

### Minor Changes

- [#2568](https://github.com/kamilkisiela/graphql-hive/pull/2568)
  [`9a205952`](https://github.com/kamilkisiela/graphql-hive/commit/9a2059524c4f09f576b2c5dd33687113c94aadd8)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Remove experimental operations:publish
  command

- [#2568](https://github.com/kamilkisiela/graphql-hive/pull/2568)
  [`9a205952`](https://github.com/kamilkisiela/graphql-hive/commit/9a2059524c4f09f576b2c5dd33687113c94aadd8)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Use latest composable schema in
  operations:check command

### Patch Changes

- [#2594](https://github.com/kamilkisiela/graphql-hive/pull/2594)
  [`c10e1250`](https://github.com/kamilkisiela/graphql-hive/commit/c10e1250096d4ffae04696e6d2a9a9299da10974)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - prevent reading a key of undefined
  value from config file

## 0.25.1

### Patch Changes

- [#2557](https://github.com/kamilkisiela/graphql-hive/pull/2557)
  [`1a1aae6`](https://github.com/kamilkisiela/graphql-hive/commit/1a1aae63b6b22c9484eaa559375e1de35b8152b7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Hide deprecation warning when --force
  is not provided by user

## 0.25.0

### Minor Changes

- [#2544](https://github.com/kamilkisiela/graphql-hive/pull/2544)
  [`f6510317`](https://github.com/kamilkisiela/graphql-hive/commit/f6510317be6a79456a982116ca3ff13866f5c68e)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - print web schema check url when running
  `hive schema:check`.

## 0.24.0

### Minor Changes

- [#2378](https://github.com/kamilkisiela/graphql-hive/pull/2378)
  [`05b37a88`](https://github.com/kamilkisiela/graphql-hive/commit/05b37a885e347c3a9eb33235d48150770fb168eb)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support HIVE_AUTHOR and HIVE_COMMIT env
  vars

### Patch Changes

- [#2378](https://github.com/kamilkisiela/graphql-hive/pull/2378)
  [`05b37a88`](https://github.com/kamilkisiela/graphql-hive/commit/05b37a885e347c3a9eb33235d48150770fb168eb)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds windows installer

## 0.23.0

### Minor Changes

- [#2430](https://github.com/kamilkisiela/graphql-hive/pull/2430)
  [`951f6865`](https://github.com/kamilkisiela/graphql-hive/commit/951f686506d003382658ddeb25a780fb194b65d4)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Use lighter solution to get commit sha
  and author from git

## 0.22.0

### Minor Changes

- [#1730](https://github.com/kamilkisiela/graphql-hive/pull/1730)
  [`9238a1f9`](https://github.com/kamilkisiela/graphql-hive/commit/9238a1f91594923abd171c3ec2029c3eb1265055)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Added support for new warnings feature
  during `schema:check` commands

## 0.21.0

### Minor Changes

- [#2080](https://github.com/kamilkisiela/graphql-hive/pull/2080)
  [`331a1116`](https://github.com/kamilkisiela/graphql-hive/commit/331a11165e88416e9f0e138704f2dab1fb384e05)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Introduce new config file format. Please move the
  `accessToken` property to a `registry` object.

  The old top-level property approach is now considered deprecated and will no longer be supported
  in the next major version of the CLI.

  ```diff
   {
  -  "accessToken": "xxxxxd4cxxx980xxxxf3099efxxxxx"
  +  "registry": {
  +      "accessToken": "xxxxxd4cxxx980xxxxf3099efxxxxx"
  +  }
   }
  ```

- [#2080](https://github.com/kamilkisiela/graphql-hive/pull/2080)
  [`331a1116`](https://github.com/kamilkisiela/graphql-hive/commit/331a11165e88416e9f0e138704f2dab1fb384e05)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Support fetching artifacts from the CDN with
  `hive artifact:fetch`.

  See the readme for more information.

### Patch Changes

- [#1461](https://github.com/kamilkisiela/graphql-hive/pull/1461)
  [`f66f6714`](https://github.com/kamilkisiela/graphql-hive/commit/f66f6714d5841620d8fa224b67907c534e21470b)
  Thanks [@renovate](https://github.com/apps/renovate)! - Update oclif@3.7.0

## 0.20.2

### Patch Changes

- [#1326](https://github.com/kamilkisiela/graphql-hive/pull/1326)
  [`99f7c66a`](https://github.com/kamilkisiela/graphql-hive/commit/99f7c66a44dc0ff5d209fdfcd5d9620dcd51171a)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Do not show "Skipping" when publishing
  schema to the modern model

## 0.20.1

### Patch Changes

- [`3688d09a`](https://github.com/kamilkisiela/graphql-hive/commit/3688d09ab4421b4dc3d16e866ec1e1f6dc91bffc)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Update README

## 0.20.0

### Minor Changes

- [`854e22fb`](https://github.com/kamilkisiela/graphql-hive/commit/854e22fbe4e3fe2f3d3f5442c15d987a357845e7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds `schema:delete` command

### Patch Changes

- [#1261](https://github.com/kamilkisiela/graphql-hive/pull/1261)
  [`ce829b50`](https://github.com/kamilkisiela/graphql-hive/commit/ce829b50721175181d5f945c392cd1a8b51a85df)
  Thanks [@renovate](https://github.com/apps/renovate)! - update oclif

## 0.19.12

### Patch Changes

- [#1047](https://github.com/kamilkisiela/graphql-hive/pull/1047)
  [`8c2cc65b`](https://github.com/kamilkisiela/graphql-hive/commit/8c2cc65b9489278196905a6e42056641de002230)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump

## 0.19.11

### Patch Changes

- [#904](https://github.com/kamilkisiela/graphql-hive/pull/904)
  [`20edc8c5`](https://github.com/kamilkisiela/graphql-hive/commit/20edc8c5e54cd71a726f02f33f9710460fc6d5a0)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Upgrade dependency git-parse to v3

- [#909](https://github.com/kamilkisiela/graphql-hive/pull/909)
  [`9a4a69bb`](https://github.com/kamilkisiela/graphql-hive/commit/9a4a69bb83760bf8e83961cc0a878899f7715da7)
  Thanks [@dotansimha](https://github.com/dotansimha)! - Upgrade oclif to latest version

- [#930](https://github.com/kamilkisiela/graphql-hive/pull/930)
  [`a972fe26`](https://github.com/kamilkisiela/graphql-hive/commit/a972fe26f2c3624dd4e66b36edf91ce3dbae78c7)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Support nullable Query.latestVersion

## 0.19.10

### Patch Changes

- Updated dependencies
  [[`e116841`](https://github.com/kamilkisiela/graphql-hive/commit/e116841a739bfd7f37c4a826544301cf23d61637)]:
  - @graphql-hive/core@0.2.3

## 0.19.9

### Patch Changes

- [#655](https://github.com/kamilkisiela/graphql-hive/pull/655)
  [`2cbf27f`](https://github.com/kamilkisiela/graphql-hive/commit/2cbf27fdc9c18749b8969adb6d1598338762dba2)
  Thanks [@n1ru4l](https://github.com/n1ru4l)! - Add User-Agent header to all http requests

## 0.19.8

### Patch Changes

- [#648](https://github.com/kamilkisiela/graphql-hive/pull/648)
  [`84a78fc`](https://github.com/kamilkisiela/graphql-hive/commit/84a78fc2a4061e05b1bbe4a8d11006601c767384)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - bump

## 0.19.7

### Patch Changes

- [#646](https://github.com/kamilkisiela/graphql-hive/pull/646)
  [`65f3372`](https://github.com/kamilkisiela/graphql-hive/commit/65f3372dfa047238352beee113ccb8506cc180ca)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - I hope it's final bump

## 0.19.6

### Patch Changes

- [#645](https://github.com/kamilkisiela/graphql-hive/pull/645)
  [`7110555`](https://github.com/kamilkisiela/graphql-hive/commit/71105559b67f510087223ada2af23564ff053353)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Ignore npm-shrinkwrap.json

## 0.19.5

### Patch Changes

- [#641](https://github.com/kamilkisiela/graphql-hive/pull/641)
  [`ce55b72`](https://github.com/kamilkisiela/graphql-hive/commit/ce55b724b00ff7fc93f3df4089e698e6f9d5086b)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Do not include npm-shrinkwrap.json

## 0.19.4

### Patch Changes

- [#631](https://github.com/kamilkisiela/graphql-hive/pull/631)
  [`d4ca981`](https://github.com/kamilkisiela/graphql-hive/commit/d4ca98180bd0b2910fb41f623c2f5abb1f4b9214)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump

- [#631](https://github.com/kamilkisiela/graphql-hive/pull/631)
  [`d4ca981`](https://github.com/kamilkisiela/graphql-hive/commit/d4ca98180bd0b2910fb41f623c2f5abb1f4b9214)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump CLI

## 0.19.3

### Patch Changes

- [#629](https://github.com/kamilkisiela/graphql-hive/pull/629)
  [`750b46d`](https://github.com/kamilkisiela/graphql-hive/commit/750b46d155c5d01ad4b3cee84409793736246603)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump

## 0.19.2

### Patch Changes

- [#627](https://github.com/kamilkisiela/graphql-hive/pull/627)
  [`78096dc`](https://github.com/kamilkisiela/graphql-hive/commit/78096dcfbd37059fbb309e8faa6bae1d14e18c79)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - bump

## 0.19.1

### Patch Changes

- [#466](https://github.com/kamilkisiela/graphql-hive/pull/466)
  [`2e036ac`](https://github.com/kamilkisiela/graphql-hive/commit/2e036acc4ce1c27a493e90481bb10f5886c0a00c)
  Thanks [@ardatan](https://github.com/ardatan)! - Update GraphQL Tools packages

## 0.19.0

### Minor Changes

- [#357](https://github.com/kamilkisiela/graphql-hive/pull/357)
  [`30f11c4`](https://github.com/kamilkisiela/graphql-hive/commit/30f11c40054debfcbd8b6090316d129eb7851046)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Adds experimental_acceptBreakingChanges

## 0.18.2

### Patch Changes

- [#292](https://github.com/kamilkisiela/graphql-hive/pull/292)
  [`efb03e1`](https://github.com/kamilkisiela/graphql-hive/commit/efb03e184d5a878dbcca83295b2d1d53b3c9f8e3)
  Thanks [@kamilkisiela](https://github.com/kamilkisiela)! - Bump @oclif/core dependency range to
  ^1.13.10

## 0.18.1

### Patch Changes

- 41ec31b: Update GraphQL Inspector range to ~3.2.0

## 0.18.0

### Minor Changes

- 25d6b01: Migrate to Authorization header (previously X-API-Token)

### Patch Changes

- 8035861: Better error messages for SDL syntax errors.

## 0.17.0

### Minor Changes

- ae6ae2f: Print link to the website when publishing new schema
- fa5045f: Use graphql@^16.0.0 as direct dependency

## 0.16.0

### Minor Changes

- 23eb4cc: Add message about empty schema registry in schema:check

## 0.15.0

### Minor Changes

- 5de7e38: Support SchemaPublishMissingUrlError type

## 0.14.6

### Patch Changes

- ce343ac: Bump

## 0.14.5

### Patch Changes

- ad66973: Bump
- Updated dependencies [ad66973]
  - @graphql-hive/core@0.2.2

## 0.14.4

### Patch Changes

- 0a5dbeb: Point to graphql-hive.com
- Updated dependencies [0a5dbeb]
  - @graphql-hive/core@0.2.1

## 0.14.3

### Patch Changes

- 9e487129: Bump

## 0.14.2

### Patch Changes

- c87df3ad: Bump

## 0.14.1

### Patch Changes

- 11958e9d: Add update command to self-update Hive CLI

## 0.14.0

### Minor Changes

- 6290ec23: Introduce operations:check to validate GraphQL Operations against latest schema
- 6290ec23: Rename operation:publish command to operations:publish

## 0.13.0

### Minor Changes

- d5db6070: Support URLs

## 0.12.0

### Minor Changes

- d9fbd878: Add --github flag to schema:publish command

## 0.11.0

### Minor Changes

- ac9b868c: Support GraphQL v16
- e03185a7: GitHub Application

### Patch Changes

- Updated dependencies [ac9b868c]
  - @graphql-hive/core@0.2.0

## 0.10.0

### Minor Changes

- c5bfa4c9: Add a new `metadata` flag for publishing schema metadata (JSON) to Hive.

  The `--metadata` can contain anything you wish to have attached to your GraphQL schema, and can
  support your runtime needs.

  You can either specify a path to a file: `--metadata my-file.json`, or an inline JSON object:
  `--metadata '{"test": 1}'`.

  Metadata published to Hive will be available as part of Hive CDN, under `/metadata` route.

## 0.9.6

### Patch Changes

- 903edf84: Bump

## 0.9.5

### Patch Changes

- ccb93298: Remove content-encoding header and improve error logs

## 0.9.4

### Patch Changes

- 28bc8af3: Fix version header

## 0.9.3

### Patch Changes

- 3a435baa: Show one value of x-request-id

## 0.9.2

### Patch Changes

- 79d4b4c2: fix(deps): update envelop monorepo

## 0.9.1

### Patch Changes

- 016dd92c: handle missing service name argument for federation and stitching projects

## 0.9.0

### Minor Changes

- 7eca7f0: Display access to commands

## 0.8.1

### Patch Changes

- 273f096: show registry url

## 0.8.0

### Minor Changes

- 91a6957: Allow to update url of a service

## 0.7.0

### Minor Changes

- 6f204be: Display token info

## 0.6.4

### Patch Changes

- 52ab1f2: Find .git directory when CLI is installed globally

## 0.6.3

### Patch Changes

- 73a840d: Warn about missing git and make git optional

## 0.6.2

### Patch Changes

- df6c501: Do not exit with 0 when forceSafe

## 0.6.1

### Patch Changes

- aff0857: Throw on empty schema and use x-request-id as reference

## 0.6.0

### Minor Changes

- 4647d25: Add --forceSafe flag to mark the check as non-breaking regardless of breaking changes

## 0.5.0

### Minor Changes

- 0e712c7: Update normalization logic

### Patch Changes

- 0e712c7: Support --url

## 0.4.9

### Patch Changes

- Updated dependencies [d7348a3]
- Updated dependencies [d7348a3]
  - @graphql-hive/core@0.1.0

## 0.4.8

### Patch Changes

- 6214042: Fix auto-update error related to oclif

## 0.4.7

### Patch Changes

- bda322c: Add --require flag and normalize schema printing

## 0.4.6

### Patch Changes

- 5aa5e93: Bump

## 0.4.5

### Patch Changes

- 968614d: Fix persisting the same query twice
- 968614d: Add auto-updates and new-version warnings

## 0.4.4

### Patch Changes

- 1a16360: Send GraphQL Client name and version

## 0.4.3

### Patch Changes

- 41a9117: Fix an issue when publishing a schema for the first time

## 0.4.2

### Patch Changes

- c6ef3d2: Bob update
- 4224cb9: Support HIVE\_\* env variables
- Updated dependencies [c6ef3d2]
  - @graphql-hive/core@0.0.5

## 0.4.1

### Patch Changes

- aa12cdc: Use process.cwd()
- aa12cdc: Use HIVE_SPACE instead of REGISTRY_KEY env var

## 0.4.0

### Minor Changes

- e8dc8c6: Move file to be an argument, fix config

## 0.3.2

### Patch Changes

- 85b85d4: Dependencies update, cleanup, ui fixes

## 0.3.1

### Patch Changes

- Updated dependencies [4a7c569]
  - @graphql-hive/core@0.0.4

## 0.3.0

### Minor Changes

- 34cff78: Added support for specifying multiple configs in hive json file

## 0.2.1

### Patch Changes

- e257a0d: Support relay-like outputs of persisted operations
- bb5b3c4: Preparations for persisted operations in Lance

## 0.2.0

### Minor Changes

- acab74b: Added support for persisted operations - Changes made in API, APP, CLI, Server, Storage

## 0.1.1

### Patch Changes

- 79fe734: Set default registry url

## 0.1.0

### Minor Changes

- 078e758: Token per Target
- 1dd9cdb: --file flag is now replaced with a positional arg at the end, comments in graphql sdl
  files are now converted to descriptions, docs are updated to mention wildcard file uploads

### Patch Changes

- 60cd35d: Use default endpoint

## 0.0.5

### Patch Changes

- d433269: Fixes

## 0.0.4

### Patch Changes

- d64a3c5: Target 2017

## 0.0.3

### Patch Changes

- 7e88e71: bump

## 0.0.2

### Patch Changes

- b2d686e: bump
