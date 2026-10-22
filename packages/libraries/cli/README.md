# Hive Console CLI (Command Line Interface)

[Hive Console](https://the-guild.dev/graphql/hive) is a fully open-source schema registry,
analytics, metrics and gateway for
[GraphQL federation](https://the-guild.dev/graphql/hive/federation) and other GraphQL APIs.

---

A CLI util to manage and control your Hive.

[![Version](https://img.shields.io/npm/v/@graphql-hive/cli.svg)](https://npmjs.org/package/@graphql-hive/cli)

## Installation

### NodeJS

If you are running a JavaScript/NodeJS project, you can install Hive CLI from the `npm` registry:

```
pnpm install -D @graphql-hive/cli
yarn add -D @graphql-hive/cli
npm install -D @graphql-hive/cli
```

> We recommend installing Hive CLI as part of your project, under `devDependencies`, instead of
> using a global installation.

### Binary

If you are running a non-JavaScript project, you can download the prebuilt binary of Hive CLI using
the following command:

```bash
curl -sSL https://graphql-hive.com/install.sh | sh
```

Each version's standalone archives and `SHA256SUMS` manifest are attached to its GitHub release. The
manifest is also available from `https://cli.graphql-hive.com/versions/VERSION/SHA256SUMS`. The
exact version currently promoted to the standalone stable channel is available as plain text from
`https://cli.graphql-hive.com/channels/stable/VERSION`; its body is the semantic version followed by
a newline.

Historical versions whose standalone archives are retained anywhere under `versions/VERSION/`
receive manifests through the manual **Backfill CLI checksum manifests** workflow. Run it from
`main` with `publish` disabled to preview missing manifests, then run it again with `publish`
enabled. The workflow preserves existing manifests, creates only missing `SHA256SUMS` objects,
verifies each through the public endpoint, and fails if any retained version remains without a
manifest.

## Commands

<!-- commands -->

- [`hive app:check OPERATIONS`](#hive-appcheck-operations)
- [`hive app:create OPERATIONS`](#hive-appcreate-operations)
- [`hive app:publish`](#hive-apppublish)
- [`hive app:retire`](#hive-appretire)
- [`hive artifact:fetch`](#hive-artifactfetch)
- [`hive dev`](#hive-dev)
- [`hive help [COMMAND]`](#hive-help-command)
- [`hive introspect LOCATION`](#hive-introspect-location)
- [`hive operations:check FILE`](#hive-operationscheck-file)
- [`hive schema:check FILE`](#hive-schemacheck-file)
- [`hive schema:delete SERVICE`](#hive-schemadelete-service)
- [`hive schema:fetch [COMMIT]`](#hive-schemafetch-commit)
- [`hive schema:promote`](#hive-schemapromote)
- [`hive schema:publish [FILE]`](#hive-schemapublish-file)
- [`hive schema:push FILE`](#hive-schemapush-file)
- [`hive update [CHANNEL]`](#hive-update-channel)
- [`hive whoami`](#hive-whoami)

## `hive app:check OPERATIONS`

checks app operations against the latest published schema

```
USAGE
  $ hive app:check OPERATIONS [--debug] [--registry.header <value>...] [--registry.endpoint <value>]
    [--registry.accessToken <value>] [--target <value>]

ARGUMENTS
  OPERATIONS  Path to the persisted operations manifest (GraphQL Code Generator, Relay or Apollo persisted query
              manifest JSON file), a directory containing .graphql files, or a glob pattern matching .graphql files.

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target against which the app operations are checked. This can either be a slug
                                  following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").

DESCRIPTION
  checks app operations against the latest published schema
```

_See code:
[src/commands/app/check.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/app/check.ts)_

## `hive app:create OPERATIONS`

create an app deployment

```
USAGE
  $ hive app:create OPERATIONS --name <value> [--debug] [--registry.header <value>...] [--registry.endpoint
    <value>] [--registry.accessToken <value>] [--version <value>] [--target <value>] [--publish]

ARGUMENTS
  OPERATIONS  Path to the persisted operations manifest (GraphQL Code Generator, Relay or Apollo persisted query
              manifest JSON file), a directory containing .graphql files, or a glob pattern matching .graphql files.

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --name=<value>                  (required) app name
  --publish                       Publish the app deployment after creation.
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target in which the app deployment will be created. This can either be a slug
                                  following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --version=<value>               app version

DESCRIPTION
  create an app deployment
```

_See code:
[src/commands/app/create.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/app/create.ts)_

## `hive app:publish`

publish an app deployment

```
USAGE
  $ hive app:publish --name <value> --version <value> [--debug] [--registry.header <value>...]
    [--registry.endpoint <value>] [--registry.accessToken <value>] [--target <value>]

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --name=<value>                  (required) app name
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target in which the app deployment will be published (slug or ID). This can either
                                  be a slug following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --version=<value>               (required) app version

DESCRIPTION
  publish an app deployment
```

_See code:
[src/commands/app/publish.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/app/publish.ts)_

## `hive app:retire`

retire an app deployment

```
USAGE
  $ hive app:retire --name <value> --version <value> [--debug] [--registry.header <value>...]
    [--registry.endpoint <value>] [--registry.accessToken <value>] [--target <value>] [--force]

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --force                         Force retirement even if protection rules would block it
  --name=<value>                  (required) app name
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target in which the app deployment will be retired (slug or ID). This can either
                                  be a slug following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --version=<value>               (required) app version

DESCRIPTION
  retire an app deployment
```

_See code:
[src/commands/app/retire.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/app/retire.ts)_

## `hive artifact:fetch`

fetch artifacts from the CDN

```
USAGE
  $ hive artifact:fetch --artifact sdl|supergraph|metadata|services|sdl.graphql|sdl.graphqls [--debug]
    [--registry.header <value>...] [--cdn.endpoint <value>] [--cdn.accessToken <value>] [--outputFile <value>]

FLAGS
  --artifact=<option>           (required) artifact to fetch (Note: supergraph is only available for federation
                                projects)
                                <options: sdl|supergraph|metadata|services|sdl.graphql|sdl.graphqls>
  --cdn.accessToken=<value>     CDN access token
  --cdn.endpoint=<value>        CDN endpoint
  --debug                       Whether debug output for HTTP calls and similar should be enabled.
  --outputFile=<value>          whether to write to a file instead of stdout
  --registry.header=<value>...  HTTP header to add to registry requests (in Name=Value format)

DESCRIPTION
  fetch artifacts from the CDN
```

_See code:
[src/commands/artifact/fetch.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/artifact/fetch.ts)_

## `hive dev`

Develop and compose Supergraph with your local services.

```
USAGE
  $ hive dev (--url <address>... --service <string>...) [--debug] [--registry.header <value>...]
    [--registry.endpoint <value> --remote] [--registry <value> ] [--registry.accessToken <value> ] [--token <value> ]
    [--schema <filepath>... ] [--header <value>...] [--watch] [--watchInterval <value>] [--write <value>] [--target
    <value>]

FLAGS
  --debug
      Whether debug output for HTTP calls and similar should be enabled.

  --header=<value>...
      HTTP header to add to a subgraph introspection request (in key:value format). A --header before any --service
      applies to all services (global). A --header placed after a --service applies only to that service, until the next
      --service is encountered, and overrides a global header of the same name for that service. This includes headers
      placed after the LAST --service: they scope only to that final service, not to all services.

  --registry=<value>
      registry address (deprecated in favor of --registry.endpoint)

  --registry.accessToken=<value>
      registry access token

  --registry.endpoint=<value>
      registry endpoint

  --registry.header=<value>...
      HTTP header to add to registry requests (in Name=Value format)

  --remote
      Compose provided services remotely

  --schema=<filepath>...
      Service sdl. If not provided, will be introspected from the service

  --service=<string>...
      (required) Service name

  --target=<value>
      The target to use for composition (slug or ID). This can either be a slug following the format
      "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging") or an UUID (e.g.
      "a0f4c605-6541-4350-8cfe-b31f21a4bf80").

  --token=<value>
      api token (deprecated in favor of --registry.accessToken)

  --url=<address>...
      (required) Service url

  --watch
      Watch mode

  --watchInterval=<value>
      [default: 1000] Watch interval in milliseconds

  --write=<value>
      [default: supergraph.graphql] Where to save the supergraph schema file

DESCRIPTION
  Develop and compose Supergraph with your local services.
  Only available for Federation projects.

  Two modes are available:
  1. Local mode (default): Compose provided services locally. (Uses Hive's native Federation v2 composition)
  2. Remote mode: Perform composition remotely (according to project settings) using all services registered in the
  registry.
```

_See code:
[src/commands/dev.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/dev.ts)_

## `hive help [COMMAND]`

Display help for hive.

```
USAGE
  $ hive help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for hive.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.36/src/commands/help.ts)_

## `hive introspect LOCATION`

introspects a GraphQL Schema

```
USAGE
  $ hive introspect LOCATION [--debug] [--registry.header <value>...] [--write <value>] [--header <value>...]
    [--type <value>]

ARGUMENTS
  LOCATION  GraphQL Schema location (URL or file path/glob)

FLAGS
  --debug                       Whether debug output for HTTP calls and similar should be enabled.
  --header=<value>...           HTTP header to add to the introspection request (in key:value format)
  --registry.header=<value>...  HTTP header to add to registry requests (in Name=Value format)
  --type=<value>                Type of the endpoint (possible types: 'federation', 'graphql'). If not provided
                                federation introspection followed by graphql introspection is attempted.
  --write=<value>               Write to a file (possible extensions: .graphql, .gql, .gqls, .graphqls, .json)

DESCRIPTION
  introspects a GraphQL Schema
```

_See code:
[src/commands/introspect.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/introspect.ts)_

## `hive operations:check FILE`

checks operations against a published schema

```
USAGE
  $ hive operations:check FILE [--debug] [--registry.header <value>...] [--registry.endpoint <value>] [--registry
    <value>] [--registry.accessToken <value>] [--token <value>] [--require <value>...] [--graphqlTag <value>...]
    [--globalGraphqlTag <value>...] [--apolloClient] [--target <value>]

ARGUMENTS
  FILE  Glob pattern to find the operations

FLAGS
  --apolloClient
      Supports Apollo Client specific directives

  --debug
      Whether debug output for HTTP calls and similar should be enabled.

  --globalGraphqlTag=<value>...
      Allows to use a global identifier instead of a module import. Similar to --graphqlTag.
      Examples:
      --globalGraphqlTag gql (Supports: export const meQuery = gql`{ me { id } }`)
      --globalGraphqlTag graphql (Supports: export const meQuery = graphql`{ me { id } }`)

  --graphqlTag=<value>...
      Identify template literals containing GraphQL queries in JavaScript/TypeScript code. Supports multiple values.
      Examples:
      --graphqlTag graphql-tag (Equivalent to: import gqlTagFunction from "graphql-tag")
      --graphqlTag graphql:react-relay (Equivalent to: import { graphql } from "react-relay")

  --registry=<value>
      registry address

  --registry.accessToken=<value>
      registry access token

  --registry.endpoint=<value>
      registry endpoint

  --registry.header=<value>...
      HTTP header to add to registry requests (in Name=Value format)

  --require=<value>...
      [default: ] Loads specific require.extensions before running the command

  --target=<value>
      The target to which to check agains (slug or ID). This can either be a slug following the format
      "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging") or an UUID (e.g.
      "a0f4c605-6541-4350-8cfe-b31f21a4bf80").

  --token=<value>
      api token

DESCRIPTION
  checks operations against a published schema
```

_See code:
[src/commands/operations/check.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/operations/check.ts)_

## `hive schema:check FILE`

checks schema

```
USAGE
  $ hive schema:check FILE [--debug] [--registry.header <value>...] [--service <value>] [--registry.endpoint
    <value>] [--registry <value>] [--registry.accessToken <value>] [--token <value>] [--experimentalJsonFile <value>]
    [--forceSafe] [--github] [--require <value>...] [--author <value>] [--commit <value>] [--baseline <value>]
    [--contextId <value>] [--target <value>] [--url <value>] [--schemaProposalId <value>]

ARGUMENTS
  FILE  Path to the schema file(s)

FLAGS
  --author=<value>                Author of the change
  --baseline=<value>              File containing the schema before the current change.
                                  Baseline schema to compare against. Accepts a local file path or a file at aGit
                                  revision using `<revision>:<path>`.
  --commit=<value>                Associated commit sha
  --contextId=<value>             Context ID for grouping the schema check.
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --experimentalJsonFile=<value>  File path to output a JSON file containing the command's result. Useful for e.g. CI
                                  scripting with `jq`.
  --forceSafe                     mark the check as safe, breaking changes are expected
  --github                        Connect with GitHub Application
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --require=<value>...            [default: ] Loads specific require.extensions before running the codegen and reading
                                  the configuration
  --schemaProposalId=<value>      Attach the schema check to a schema proposal.
  --service=<value>               service name (only for distributed schemas)
  --target=<value>                The target against which to check the schema (slug or ID). This can either be a slug
                                  following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --token=<value>                 api token
  --url=<value>                   If checking a service, then you can optionally provide the service URL to see the
                                  difference in the supergraph during the check.

DESCRIPTION
  checks schema
```

_See code:
[src/commands/schema/check.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/check.ts)_

## `hive schema:delete SERVICE`

deletes a schema

```
USAGE
  $ hive schema:delete SERVICE [--debug] [--registry.header <value>...] [--registry.endpoint <value>] [--registry
    <value>] [--registry.accessToken <value>] [--token <value>] [--dryRun] [--confirm] [--target <value>]

ARGUMENTS
  SERVICE  name of the service

FLAGS
  --confirm                       Confirm deletion of the service
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --dryRun                        Does not delete the service, only reports what it would have done. Skips confirmation
                                  prompt.
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target to which to publish to (slug or ID). This can either be a slug following
                                  the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --token=<value>                 api token

DESCRIPTION
  deletes a schema
```

_See code:
[src/commands/schema/delete.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/delete.ts)_

## `hive schema:fetch [COMMIT]`

fetch a schema, supergraph, or list of subgraphs from the Hive API

```
USAGE
  $ hive schema:fetch [COMMIT] [--debug] [--registry.header <value>...] [--registry <value>] [--token <value>]
    [--registry.endpoint <value>] [--registry.accessToken <value>] [--type <value>] [--write <value>] [--outputFile
    <value>] [--target <value>]

ARGUMENTS
  [COMMIT]  commit SHA, or it can be any external ID that references the schema

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --outputFile=<value>            whether to write to a file instead of stdout
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --target=<value>                The target from which to fetch the schema (slug or ID). This can either be a slug
                                  following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                  "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --token=<value>                 api token
  --type=<value>                  Type to fetch (possible types: sdl, supergraph, subgraphs)
  --write=<value>                 Write to a file (possible extensions: .graphql, .gql, .gqls, .graphqls)

DESCRIPTION
  fetch a schema, supergraph, or list of subgraphs from the Hive API
```

_See code:
[src/commands/schema/fetch.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/fetch.ts)_

## `hive schema:promote`

promote a schema version

```
USAGE
  $ hive schema:promote --to <value> [--debug] [--registry.header <value>...] [--registry.endpoint <value>]
    [--registry <value>] [--registry.accessToken <value>] [--token <value>] [--from <value>] [--version <value>]

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --from=<value>                  The target to which the schema version should be promoted from (slug or ID). This can
                                  either be a slug following the format "$organizationSlug/$projectSlug/$targetSlug"
                                  (e.g "the-guild/graphql-hive/staging") or an UUID (e.g.
                                  "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --to=<value>                    (required) The target to which the schema version should be promoted to (slug or ID).
                                  This can either be a slug following the format
                                  "$organizationSlug/$projectSlug/$targetSlug" (e.g "the-guild/graphql-hive/staging") or
                                  an UUID (e.g. "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --token=<value>                 api token
  --version=<value>               The specific schema version ID to promote. It must be within the same project as the
                                  target the version should be promoted to.

DESCRIPTION
  promote a schema version
```

_See code:
[src/commands/schema/promote.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/promote.ts)_

## `hive schema:publish [FILE]`

publishes schema

```
USAGE
  $ hive schema:publish [FILE] [--debug] [--registry.header <value>...] [--service <value>] [--url <value>]
    [--metadata <value>] [--registry.endpoint <value>] [--registry <value>] [--registry.accessToken <value>] [--token
    <value>] [--author <value>] [--commit <value>] [--revision <value>] [--github] [--force]
    [--experimental_acceptBreakingChanges] [--fail-on-composition-error] [--require <value>...] [--target <value>]

ARGUMENTS
  [FILE]  Path to the schema file(s), must be omitted when using --revision

FLAGS
  --author=<value>                      author of the change
  --commit=<value>                      The associated commit SHA, or optionally any external identifier that references
                                        the schema
  --debug                               Whether debug output for HTTP calls and similar should be enabled.
  --experimental_acceptBreakingChanges  (experimental) accept breaking changes and mark schema as valid (only if
                                        composable)
  --fail-on-composition-error           prevent publishing a federation schema if it would cause a composition error
  --force                               force publish even on breaking changes
  --github                              Connect with GitHub Application
  --metadata=<value>                    additional metadata to attach to the GraphQL schema. This can be a string with a
                                        valid JSON, or a path to a file containing a valid JSON
  --registry=<value>                    registry address
  --registry.accessToken=<value>        registry access token
  --registry.endpoint=<value>           registry endpoint
  --registry.header=<value>...          HTTP header to add to registry requests (in Name=Value format)
  --require=<value>...                  [default: ] Loads specific require.extensions before running the codegen and
                                        reading the configuration
  --revision=<value>                    publish a previously pushed schema revision
  --service=<value>                     service name (only for distributed schemas)
  --target=<value>                      The target to which to publish to (slug or ID). This can either be a slug
                                        following the format "$organizationSlug/$projectSlug/$targetSlug" (e.g
                                        "the-guild/graphql-hive/staging") or an UUID (e.g.
                                        "a0f4c605-6541-4350-8cfe-b31f21a4bf80").
  --token=<value>                       api token
  --url=<value>                         service url (only for distributed schemas)

DESCRIPTION
  publishes schema
```

_See code:
[src/commands/schema/publish.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/publish.ts)_

## `hive schema:push FILE`

pushes a schema revision for later publication

```
USAGE
  $ hive schema:push FILE --target <value> --revision <value> [--debug] [--registry.header <value>...] [--service
    <value>] [--registry.endpoint <value>] [--registry <value>] [--registry.accessToken <value>] [--token <value>]
    [--require <value>...]

ARGUMENTS
  FILE  Path to the schema file(s)

FLAGS
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --require=<value>...            [default: ] Loads specific require.extensions before running the codegen and reading
                                  the configuration
  --revision=<value>              (required) immutable schema revision, such as a commit SHA
  --service=<value>               service name (required for federation and stitching projects, ignored for
                                  single-schema projects)
  --target=<value>                (required) The target to push against as "$organizationSlug/$projectSlug/$targetSlug"
                                  or a target UUID.
  --token=<value>                 api token

DESCRIPTION
  pushes a schema revision for later publication
```

_See code:
[src/commands/schema/push.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/schema/push.ts)_

## `hive update [CHANNEL]`

update the hive CLI

```
USAGE
  $ hive update [CHANNEL] [--force |  | [-a | -v <value> | -i]] [-b ]

FLAGS
  -a, --available        See available versions.
  -b, --verbose          Show more details about the available versions.
  -i, --interactive      Interactively select version to install. This is ignored if a channel is provided.
  -v, --version=<value>  Install a specific version.
      --force            Force a re-download of the requested version.

DESCRIPTION
  update the hive CLI

EXAMPLES
  Update to the stable channel:

    $ hive update stable

  Update to a specific version:

    $ hive update --version 1.0.0

  Interactively select version:

    $ hive update --interactive

  See available versions:

    $ hive update --available
```

_See code:
[@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v4.7.16/src/commands/update.ts)_

## `hive whoami`

shows information about the current token

```
USAGE
  $ hive whoami [--debug] [--registry.header <value>...] [--registry.endpoint <value>] [--registry <value>]
    [--registry.accessToken <value>] [--token <value>] [--all]

FLAGS
  --all                           Also show non-granted permissions.
  --debug                         Whether debug output for HTTP calls and similar should be enabled.
  --registry=<value>              registry address
  --registry.accessToken=<value>  registry access token
  --registry.endpoint=<value>     registry endpoint
  --registry.header=<value>...    HTTP header to add to registry requests (in Name=Value format)
  --token=<value>                 api token

DESCRIPTION
  shows information about the current token
```

_See code:
[src/commands/whoami.ts](https://github.com/graphql-hive/console/blob/v0.68.1/src/commands/whoami.ts)_

<!-- commandsstop -->

## Configuration

### Environment Variables

You may set the `HIVE_TOKEN` environment variable while running the Hive CLI, in order to set it
globally.

### Config file (`hive.json`)

You can create a `hive.json` file to manage your Hive configuration.

Note that the CLI args will override the values in config if both are specified.

The configuration input priority is: CLI args > environment variables > hive.json configuration.

This is how the structure of the config file should look like:

```json
{
  "registry": {
    "endpoint": "<yourRegistryURL>",
    "accessToken": "<yourtoken>"
  },
  "cdn": {
    "endpoint": "<yourCdnURL>",
    "accessToken": "<yourtoken>"
  }
}
```

<!-- errors -->

## Errors

Every error message ends with its error code in brackets, for example `[103]`, and is printed to
stderr. Details of a failed check or publish, such as the list of breaking changes, are printed to
stdout.

### Exit codes

| Exit code | Name        | Meaning                                                                                                          |
| --------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 0         | `SUCCESS`   | The command succeeded.                                                                                           |
| 1         | `ERROR`     | The command ran, but the operation failed.                                                                       |
| 2         | `TIMED_OUT` | A request timed out. The operation may still have completed on the server.                                       |
| 3         | `BAD_INIT`  | The command could not start because of invalid input or setup, such as arguments, flags, files or configuration. |

### Error codes

| Code                       | Error                                                               | Exit code | Fix                                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <a id="errors-100"></a>100 | Invalid configuration file (`InvalidConfigError`)                   | 3         | Fix the reported problem in `hive.json` (or the file set with `HIVE_CONFIG`). Supported keys are `registry.endpoint`, `registry.accessToken`, `registry.headers`, `cdn.endpoint` and `cdn.accessToken`. When `HIVE_SPACE` is set, the file must contain a top-level key with that name. |
| <a id="errors-101"></a>101 | Unknown command (`InvalidCommandError`)                             | 3         | Run `hive help` to list the available commands and check the spelling.                                                                                                                                                                                                                  |
| <a id="errors-102"></a>102 | Missing required argument (`MissingArgumentsError`)                 | 3         | Provide the listed arguments or flags. Organization access tokens always require the `--target` flag.                                                                                                                                                                                   |
| <a id="errors-103"></a>103 | Missing registry access token (`MissingRegistryTokenError`)         | 3         | Pass `--registry.accessToken`, set `HIVE_TOKEN`, or set `registry.accessToken` in `hive.json`.                                                                                                                                                                                          |
| <a id="errors-104"></a>104 | Missing CDN access token (`MissingCdnKeyError`)                     | 3         | Pass `--cdn.accessToken`, set `HIVE_CDN_ACCESS_TOKEN`, or set `cdn.accessToken` in `hive.json`.                                                                                                                                                                                         |
| <a id="errors-105"></a>105 | Missing registry endpoint (`MissingEndpointError`)                  | 3         | Pass `--registry.endpoint`, set `HIVE_REGISTRY`, or set `registry.endpoint` in `hive.json`. Make sure `HIVE_REGISTRY` is not set to an empty string.                                                                                                                                    |
| <a id="errors-106"></a>106 | Invalid registry access token (`InvalidRegistryTokenError`)         | 1         | Create a new access token, and check that the access token and the registry endpoint belong to the same Hive instance.                                                                                                                                                                  |
| <a id="errors-107"></a>107 | Invalid CDN access token (`InvalidCdnKeyError`)                     | 1         | Create a new CDN access token for the target, and check that it belongs to the same target as the CDN endpoint.                                                                                                                                                                         |
| <a id="errors-108"></a>108 | Missing CDN endpoint (`MissingCdnEndpointError`)                    | 3         | Pass `--cdn.endpoint`, set `HIVE_CDN_ENDPOINT`, or set `cdn.endpoint` in `hive.json`.                                                                                                                                                                                                   |
| <a id="errors-109"></a>109 | Missing environment variable (`MissingEnvironmentError`)            | 3         | Set the listed environment variables. With `--github`, run the command in GitHub Actions or set `GITHUB_REPOSITORY`.                                                                                                                                                                    |
| <a id="errors-110"></a>110 | Missing commit (`CommitRequiredError`)                              | 3         | Pass `--commit` (or set `HIVE_COMMIT` for `schema:publish`), or run the command inside a git repository.                                                                                                                                                                                |
| <a id="errors-111"></a>111 | Missing GitHub repository (`GithubRepositoryRequiredError`)         | 3         | Run the command in GitHub Actions, where `GITHUB_REPOSITORY` is set, or in a CI environment that exposes the repository.                                                                                                                                                                |
| <a id="errors-112"></a>112 | Missing author (`AuthorRequiredError`)                              | 3         | Pass `--author` (or set `HIVE_AUTHOR` for `schema:publish`), or run the command inside a git repository with a configured user.                                                                                                                                                         |
| <a id="errors-113"></a>113 | HTTP error response (`HTTPError`)                                   | 1         | A 4xx status usually means a wrong endpoint or a rejected request: check the endpoint URL and credentials. A 5xx status means the server failed: retry later.                                                                                                                           |
| <a id="errors-114"></a>114 | Network error (`NetworkError`)                                      | 1         | The request did not complete. Check the network connection, DNS, proxy and TLS settings, and the endpoint URL, then retry.                                                                                                                                                              |
| <a id="errors-115"></a>115 | API error (`APIError`)                                              | 1         | Read the message returned by the Hive API. Include the request ID when contacting support.                                                                                                                                                                                              |
| <a id="errors-116"></a>116 | Introspection failed (`IntrospectionError`)                         | 1         | Make sure the service is running, reachable and allows introspection, or pass the schema file instead of the URL.                                                                                                                                                                       |
| <a id="errors-117"></a>117 | Unsupported file extension (`UnsupportedFileExtensionError`)        | 3         | Use one of the supported file extensions listed in the message.                                                                                                                                                                                                                         |
| <a id="errors-118"></a>118 | File not found (`FileMissingError`)                                 | 3         | Check that the path or glob matches at least one readable file.                                                                                                                                                                                                                         |
| <a id="errors-119"></a>119 | Invalid file contents (`InvalidFileContentsError`)                  | 3         | Make sure the file is readable and contains valid content in the expected format.                                                                                                                                                                                                       |
| <a id="errors-120"></a>120 | Invalid target (`InvalidTargetError`)                               | 3         | Pass the target as a slug in the form `organization/project/target`, or as a target UUID.                                                                                                                                                                                               |
| <a id="errors-121"></a>121 | Not a Federation subgraph (`InvalidFederationSubgraphError`)        | 3         | Point the URL at a Federation subgraph that exposes `Query._service.sdl`, or pass the schema file instead.                                                                                                                                                                              |
| <a id="errors-122"></a>122 | Invalid schema version ID (`InvalidVersionIdError`)                 | 3         | Pass the ID of a schema version from the same project as the target.                                                                                                                                                                                                                    |
| <a id="errors-123"></a>123 | Conflicting options (`ConflictingOptionsError`)                     | 3         | Provide only one of the listed options.                                                                                                                                                                                                                                                 |
| <a id="errors-124"></a>124 | Access denied (`AccessDeniedError`)                                 | 1         | Grant the named permission to the access token, check that `--target` points at an existing target the token can access, or use an organization access token.                                                                                                                           |
| <a id="errors-125"></a>125 | Unsupported Hive server version (`UnsupportedServerError`)          | 1         | Upgrade the Hive server to a version that supports this CLI version, or use an older CLI version that matches the server. Nothing was executed on the server.                                                                                                                           |
| <a id="errors-126"></a>126 | Request timed out (`RequestTimeoutError`)                           | 2         | The operation may have completed on the server. Check its result, for example in Hive Console or with `hive schema:fetch`, before retrying.                                                                                                                                             |
| <a id="errors-127"></a>127 | Invalid command input (`InvalidInputError`)                         | 3         | Check the arguments and flags with `hive help <command>`.                                                                                                                                                                                                                               |
| <a id="errors-128"></a>128 | Invalid header (`InvalidHeaderError`)                               | 3         | Use the `Name=Value` format for `--registry.header` and the `Name:Value` format for `--header`.                                                                                                                                                                                         |
| <a id="errors-199"></a>199 | Unexpected error (`UnexpectedError`)                                | 1         | Re-run the command with `DEBUG=*` for more details, and report the output if the problem persists.                                                                                                                                                                                      |
| <a id="errors-200"></a>200 | Schema not found (`SchemaFileNotFoundError`)                        | 3         | Check the file path, glob or URL. For a URL, make sure the service is reachable.                                                                                                                                                                                                        |
| <a id="errors-201"></a>201 | No type definitions found (`SchemaFileEmptyError`)                  | 3         | Make sure the schema contains GraphQL type definitions. In code files, the definitions must be in a template literal tagged with `gql` or `graphql`, or marked with a `/* GraphQL */` comment.                                                                                          |
| <a id="errors-202"></a>202 | Schema check failed (`SchemaCheckFailedError`)                      | 1         | Review the errors and breaking changes in the output or the linked report. Fix them, approve expected breaking changes in Hive Console, or use `--forceSafe`.                                                                                                                           |
| <a id="errors-203"></a>203 | Schema check approval failed (`SchemaCheckApprovalFailedError`)     | 1         | Make sure the access token has the `schemaCheck:approve` permission and that the failed schema check was stored by the registry.                                                                                                                                                        |
| <a id="errors-300"></a>300 | Schema publish failed (`SchemaPublishFailedError`)                  | 1         | The schema was rejected and nothing was stored. Fix the reported errors and publish again.                                                                                                                                                                                              |
| <a id="errors-301"></a>301 | Invalid SDL (`InvalidSDLError`)                                     | 3         | Fix the GraphQL syntax error at the reported location.                                                                                                                                                                                                                                  |
| <a id="errors-302"></a>302 | Missing service name (`SchemaPublishMissingServiceError`)           | 3         | Pass `--service <name>`. Federation and schema stitching projects require a service name.                                                                                                                                                                                               |
| <a id="errors-303"></a>303 | Missing service URL (`SchemaPublishMissingUrlError`)                | 3         | Pass `--url <url>`. A service needs a URL the first time it is published, and the URL must be valid.                                                                                                                                                                                    |
| <a id="errors-400"></a>400 | Malformed persisted documents (`PersistedOperationsMalformedError`) | 3         | Use a GraphQL Code Generator, Relay or Apollo persisted query manifest, a directory of `.graphql` files, or a glob that matches `.graphql` files containing operations.                                                                                                                 |
| <a id="errors-401"></a>401 | Invalid operations (`InvalidPersistedDocumentsError`)               | 1         | Fix the listed operations so they comply with the requirements.                                                                                                                                                                                                                         |
| <a id="errors-500"></a>500 | Schema not found in the registry (`SchemaNotFoundError`)            | 1         | Publish a schema to the target first, or check the target, the commit and the `--type` value.                                                                                                                                                                                           |
| <a id="errors-501"></a>501 | Schema version is not valid (`InvalidSchemaError`)                  | 1         | The requested schema version is not valid. Use a different commit, or fix and publish the schema again.                                                                                                                                                                                 |
| <a id="errors-600"></a>600 | Service and URL count mismatch (`ServiceAndUrlLengthMismatch`)      | 3         | Pass exactly one `--url` for every `--service`.                                                                                                                                                                                                                                         |
| <a id="errors-601"></a>601 | Local composition failed (`LocalCompositionError`)                  | 1         | Fix the composition errors in the listed subgraphs.                                                                                                                                                                                                                                     |
| <a id="errors-602"></a>602 | Remote composition failed (`RemoteCompositionError`)                | 1         | Fix the composition errors in the listed subgraphs.                                                                                                                                                                                                                                     |
| <a id="errors-603"></a>603 | Invalid composition result (`InvalidCompositionResultError`)        | 1         | The composed supergraph is invalid. Report the output as a bug.                                                                                                                                                                                                                         |
| <a id="errors-700"></a>700 | Invalid operations (`InvalidDocumentsError`)                        | 1         | Fix the listed operations so that they are valid against the schema.                                                                                                                                                                                                                    |

<!-- errorsstop -->
