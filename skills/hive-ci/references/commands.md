# Hive CLI commands for every CI system

The reference file of each CI system maps its own variables onto the environment variables below, so
the commands are the same everywhere. Confirm every flag in the CLI command reference before using
it: https://github.com/graphql-hive/console/blob/main/packages/libraries/cli/README.md#commands

## Contents

- Environment variables used in these commands
- Install a pinned CLI
- Check a pull request
- Publish on merge (flow A)
- Check in a merge queue (flow B)
- Push, then publish at deploy time (flow C)
- Preview target per pull request (flow D)

## Environment variables used in these commands

| Variable            | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `HIVE_TOKEN`        | Access token, from the CI system's secret store. The CLI reads it automatically.              |
| `HIVE_REGISTRY`     | Self-hosted Hive only: the registry's GraphQL endpoint. The CLI reads it automatically.       |
| `HIVE_ORGANIZATION` | Organization slug.                                                                            |
| `HIVE_PROJECT`      | Project slug.                                                                                 |
| `HIVE_TARGET`       | Target slug that pull requests are checked against and merges publish to, e.g. `development`. |
| `SCHEMA_PATH`       | Schema file, glob or URL, as supported by the CLI.                                            |
| `SERVICE_NAME`      | Federation and stitching only: the service (subgraph) name.                                   |
| `SERVICE_URL`       | Federation and stitching only: the service URL, for publishing.                               |
| `COMMIT`, `AUTHOR`  | Commit SHA and author. Set from the CI system's variables. Not needed with `--github`.        |
| `CONTEXT_ID`        | `<repository>#<pull request number>` on pull request checks. Not needed with `--github`.      |
| `PR_NUMBER`         | Pull request number, for flow D.                                                              |

The commands here and the examples in the reference files show the Federation form. Leave out
`--service` and `--url` on single-schema projects, and `--fail-on-composition-error` on projects
that are not Federation.

## Install a pinned CLI

Pin the version, as the CI/CD guide describes; `npm view @graphql-hive/cli version` prints the
current release. Confirm that the version exists for the chosen install method, because the CLI
image and the install script can lag the npm release (for example
`docker manifest inspect ghcr.io/graphql-hive/cli:<version>`). Default: the install script, in the
step that runs the CLI:

```sh
curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
```

The install script installs into `/usr/local` and runs `sudo` when it is not running as root, so the
job needs root or passwordless sudo. GitHub-hosted runners, Microsoft-hosted agents and CircleCI's
`cimg` images have passwordless sudo, and GitLab and Bitbucket Pipelines jobs usually run as root in
their container.

Use one of these instead when:

- **The project uses Node.js**: add `@graphql-hive/cli` at a fixed version to `devDependencies`, and
  run it with the project's package manager (`npx hive ...`, `pnpm hive ...`, `yarn hive ...`).
- **The job has neither root nor passwordless sudo**, as on many self-hosted Jenkins and Buildkite
  agents: run the Hive steps in the CLI image `ghcr.io/graphql-hive/cli:<version>`. Its entrypoint
  is `hive` and it includes git, but not curl. CI systems that run a shell script inside the image
  must override the entrypoint.

## Check a pull request

Without the GitHub integration:

```sh
hive schema:check "$SCHEMA_PATH" \
  --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
  --service "$SERVICE_NAME" \
  --commit "$COMMIT" \
  --author "$AUTHOR" \
  --contextId "$CONTEXT_ID"
```

With the Hive GitHub integration on GitHub Actions, replace `--commit`, `--author` and `--contextId`
with `--github`.

## Publish on merge (flow A)

```sh
hive schema:publish "$SCHEMA_PATH" \
  --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
  --service "$SERVICE_NAME" \
  --url "$SERVICE_URL" \
  --commit "$COMMIT" \
  --author "$AUTHOR" \
  --fail-on-composition-error
```

Do not add `--github` here: a rejected publish would still exit with 0 (SKILL.md, Exit codes and
gating).

## Check in a merge queue (flow B)

```sh
hive schema:check "$SCHEMA_PATH" \
  --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
  --service "$SERVICE_NAME" \
  --baseline "$BASE_COMMIT:$SCHEMA_PATH" \
  --github
```

`BASE_COMMIT` is the commit the queue entry is built on, and the checkout must contain it (fetch the
full history). Only GitHub Actions provides it together with the pull request identity; see
`github-actions.md`.

## Push, then publish at deploy time (flow C)

On merge, store the schema under the commit SHA:

```sh
hive schema:push "$SCHEMA_PATH" \
  --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
  --service "$SERVICE_NAME" \
  --revision "$COMMIT"
```

In the deploy job, after the service is live, publish the same revision. The schema file is not
needed, but `--commit` and `--author` are:

```sh
hive schema:publish \
  --revision "$COMMIT" \
  --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
  --service "$SERVICE_NAME" \
  --url "$SERVICE_URL" \
  --commit "$COMMIT" \
  --author "$AUTHOR" \
  --fail-on-composition-error
```

Pushed revisions expire if they are not published in time, and a revision name cannot be reused with
a different schema.

## Preview target per pull request (flow D)

Each pull request gets its own target, `pr-<number>`. Target slugs are at most 50 characters of
lowercase letters, digits and dashes, so build the slug from the pull request number, never from the
branch name. The token needs `target:create`, and on all targets of the project `target:delete`,
`schemaVersion:promote`, `schemaCheck:create` and `schemaVersion:publish`.

Creating and deleting targets uses the public GraphQL API
(https://the-guild.dev/graphql/hive/docs/api-reference/graphql-api). The skill's
`scripts/hive-preview.sh` wraps those calls. Copy it into the repository as
`scripts/hive-preview.sh` and source it in the CI step, with the variables from the table above set
(`PR_NUMBER` names the target). It needs `curl` and a POSIX shell.

| Function                          | What it does                                                                                                                                                                | Token permission                                                  |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `preview_target_exists`           | Succeeds if the pull request's target exists.                                                                                                                               |                                                                   |
| `create_preview_target`           | Creates the target.                                                                                                                                                         | `target:create`                                                   |
| `delete_preview_target`           | Deletes the target, and with it its CDN tokens.                                                                                                                             | `target:delete`                                                   |
| `hive_preview_publish`            | Creates the target if it is missing, promotes the base target's latest version into it, then publishes the pull request's schema to it. Fails on the first step that fails. | `target:create`, `schemaVersion:promote`, `schemaVersion:publish` |
| `create_preview_cdn_token <file>` | Creates a CDN access token for the target and writes `HIVE_CDN_ENDPOINT` and `HIVE_CDN_ACCESS_TOKEN` to the file.                                                           | `cdnAccessToken:modify`                                           |

On every push to the pull request, run the check first. It fails the job before anything is created
if the schema is invalid:

```sh
# 1. Check against the base target (the "Check a pull request" command above).
# 2. Create the target if it is missing, promote, then publish.
. scripts/hive-preview.sh
hive_preview_publish
```

Promoting on every push keeps the preview in step with the base target. `schema:promote` fails if
the base target has no schema version yet.

When the pull request is merged, delete its target. Running the same cleanup when a pull request is
closed without merging stops abandoned pull requests from leaving targets behind:

```sh
. scripts/hive-preview.sh
if preview_target_exists; then delete_preview_target; fi
```

Run the preview job and the cleanup job one at a time for each pull request (for example with a
concurrency group), so a late preview job cannot recreate a deleted target.

If the preview environment reads its schema from the Hive CDN, it also needs the target's CDN
endpoint and a CDN access token (see
https://the-guild.dev/graphql/hive/docs/schema-registry/high-availability-cdn). Creating one needs
`cdnAccessToken:modify` on all targets. `create_preview_cdn_token <file>` writes both to the file,
as `HIVE_CDN_ENDPOINT` and `HIVE_CDN_ACCESS_TOKEN` (the names `hive artifact:fetch` reads), and
never prints the secret. Each call creates a new token, and deleting the target deletes its tokens.
Hand the file to the preview deployment through the CI system's secret mechanism: a file saved as a
job artifact can be read by anyone who can download the job's artifacts.
