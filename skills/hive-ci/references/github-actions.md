# GitHub Actions

Use the commands from `commands.md`. This file maps GitHub's variables onto them. The workflows in
the CI/CD guide are the reference: https://the-guild.dev/graphql/hive/docs/other-integrations/ci-cd

## Contents

- Secrets and variables
- Install
- Flow A: check pull requests, publish on merge
- Flow B: merge queue
- Flow C: push on merge, publish at deploy time
- Flow D: preview target per pull request

## Secrets and variables

- Store tokens as repository or organization secrets, and expose them per step:
  `env: HIVE_TOKEN: ${{ secrets.HIVE_CHECK_TOKEN }}`. Use separate tokens for checking and
  publishing.
- **With the Hive GitHub integration** (`--github`): the CLI reads the commit, the author and the
  pull request from the event, including `merge_group` events, and reports the result as a check
  run. Do not pass `--commit`, `--author` or `--contextId`. The integration must be connected to the
  organization and the project must be linked to the repository:
  https://the-guild.dev/graphql/hive/docs/schema-registry/management/organizations#github
- **Without `--github`**, pass them explicitly:

| Event                    | `COMMIT`                                    | `AUTHOR`                                                                                     | `CONTEXT_ID`                                                       |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pull_request`           | `${{ github.event.pull_request.head.sha }}` | `${{ github.event.pull_request.user.login }}`                                                | `${{ github.repository }}#${{ github.event.pull_request.number }}` |
| `push`                   | `${{ github.sha }}`                         | `${{ github.event.head_commit.author.name }} <${{ github.event.head_commit.author.email }}>` | not needed                                                         |
| deploy (any other event) | `${{ github.sha }}`                         | `${{ github.actor }}`                                                                        | not needed                                                         |

On `pull_request` events, `github.sha` is a temporary merge commit, so use the pull request's head
commit instead.

## Install

GitHub-hosted runners have curl and passwordless sudo, so the install script (see Install in
`commands.md`) runs in the same step as the CLI, as the CI/CD guide does:

```yaml
run: |
  curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
  hive schema:check ...
```

Node.js projects: add `@graphql-hive/cli` to `devDependencies` instead (see Install in
`commands.md`), install dependencies in the job, and replace the install line with the package
manager, for example `pnpm hive schema:check ...` or `npx hive schema:check ...`.

## Flow A: check pull requests, publish on merge

```yaml
# .github/workflows/hive.yml
name: Hive
on:
  pull_request:
  push:
    branches: [main]

env:
  HIVE_CLI_VERSION: 0.66.0 # pin to the current release
  HIVE_ORGANIZATION: my-organization
  HIVE_PROJECT: my-project
  HIVE_TARGET: development
  SCHEMA_PATH: schema.graphql
  SERVICE_NAME: products # Federation and stitching only
  SERVICE_URL: https://products.example.com/graphql # Federation and stitching only

jobs:
  check:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Hive schema check
        env:
          HIVE_TOKEN: ${{ secrets.HIVE_CHECK_TOKEN }}
        run: |
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          hive schema:check "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --github

  publish:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Hive schema publish
        env:
          HIVE_TOKEN: ${{ secrets.HIVE_PUBLISH_TOKEN }}
          COMMIT: ${{ github.sha }}
          AUTHOR: >-
            ${{ github.event.head_commit.author.name }} <${{ github.event.head_commit.author.email
            }}>
        run: |
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          hive schema:publish "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --url "$SERVICE_URL" \
            --commit "$COMMIT" \
            --author "$AUTHOR" \
            --fail-on-composition-error
```

Without the Hive GitHub integration, replace `--github` in the check with `--commit`, `--author` and
`--contextId`, set from the `pull_request` row of the table above. The publish step leaves out
`--github` on purpose (SKILL.md, Exit codes and gating).

## Flow B: merge queue

GitHub's merge queue runs workflows on the `merge_group` event. Add it to the workflow that holds
the required check, check out the full history, and pass the queue's base commit as the baseline.
This is the CI/CD guide's merge queue workflow:

```yaml
on:
  pull_request:
  merge_group:
    types: [checks_requested]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Hive schema check
        env:
          HIVE_TOKEN: ${{ secrets.HIVE_CHECK_TOKEN }}
          BASE_COMMIT: ${{ github.event.merge_group.base_sha }}
        run: |
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          if [ -n "$BASE_COMMIT" ]; then
            BASELINE="--baseline=$BASE_COMMIT:$SCHEMA_PATH"
          fi
          hive schema:check "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            $BASELINE \
            --github
```

With `--github`, the CLI takes the pull request number and head commit from the `merge_group` event,
so breaking changes approved on the pull request stay approved in the queue.

## Flow C: push on merge, publish at deploy time

```yaml
# In the workflow that runs on push to main
- name: Hive schema push
  env:
    HIVE_TOKEN: ${{ secrets.HIVE_PUSH_TOKEN }}
  run: |
    curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
    hive schema:push "$SCHEMA_PATH" \
      --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
      --service "$SERVICE_NAME" \
      --revision "${{ github.sha }}"
```

In the deploy workflow, after the service is live, run the "publish at deploy time" command from
`commands.md` with `COMMIT: ${{ github.sha }}` and `AUTHOR: ${{ github.actor }}`. The deploy job
needs the commit SHA that was pushed; the schema file is not needed.

## Flow D: preview target per pull request

Extend flow A. Copy `scripts/hive-preview.sh` from this skill into the repository, add the `closed`
event, and add a preview job that only runs after the check passes, and a cleanup job for merged
pull requests:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
  push:
    branches: [main]

jobs:
  check:
    if: github.event_name == 'pull_request' && github.event.action != 'closed'
    # ... the rest of the check job from flow A

  # ... the publish job from flow A

  preview:
    needs: check
    runs-on: ubuntu-latest
    concurrency:
      group: hive-preview-${{ github.event.pull_request.number }}
    steps:
      - uses: actions/checkout@v4
      - name: Hive preview target
        env:
          HIVE_TOKEN: ${{ secrets.HIVE_PREVIEW_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          COMMIT: ${{ github.event.pull_request.head.sha }}
          AUTHOR: ${{ github.event.pull_request.user.login }}
        run: |
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          . scripts/hive-preview.sh
          hive_preview_publish

  cleanup:
    if: github.event.action == 'closed' && github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    concurrency:
      group: hive-preview-${{ github.event.pull_request.number }}
    steps:
      - uses: actions/checkout@v4
      - name: Delete the Hive preview target
        env:
          HIVE_TOKEN: ${{ secrets.HIVE_PREVIEW_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: |
          . scripts/hive-preview.sh
          if preview_target_exists; then delete_preview_target; fi
```

To also clean up pull requests that are closed without merging, drop the `merged == true` condition.
