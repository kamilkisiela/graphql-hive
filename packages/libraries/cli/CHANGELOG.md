# @graphql-hive/cli

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
