# Bitbucket Pipelines, Buildkite, and other CI systems

Use the commands from `commands.md`. This file maps the variables of Bitbucket Pipelines and
Buildkite onto them, and gives a recipe for any other CI system.

## Contents

- Bitbucket Pipelines
- Buildkite
- Any other CI system

## Bitbucket Pipelines

- Store tokens as secured repository or workspace variables. Bitbucket masks them in logs.
- Pull request pipelines (the `pull-requests:` section) set `BITBUCKET_PR_ID`.
- Use an image with curl and git, such as `atlassian/default-image:5`, and the install script (see
  Install in `commands.md`). Bitbucket Pipelines jobs usually run as root in their container.

| Hive variable | Bitbucket Pipelines value                                          |
| ------------- | ------------------------------------------------------------------ |
| `COMMIT`      | `$BITBUCKET_COMMIT`                                                |
| `AUTHOR`      | `$(git log -1 --format='%an <%ae>')` (there is no author variable) |
| `CONTEXT_ID`  | `$BITBUCKET_REPO_FULL_NAME#$BITBUCKET_PR_ID`                       |
| `PR_NUMBER`   | `$BITBUCKET_PR_ID`                                                 |

Flow A, with the non-secret settings (`HIVE_ORGANIZATION`, `HIVE_PROJECT`, `HIVE_TARGET`,
`SCHEMA_PATH`, `SERVICE_NAME`, `SERVICE_URL`, `HIVE_CLI_VERSION`) set as repository variables:

```yaml
# bitbucket-pipelines.yml
image: atlassian/default-image:5

pipelines:
  pull-requests:
    '**':
      - step:
          name: Hive schema check
          script:
            - curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
            - export HIVE_TOKEN="$HIVE_CHECK_TOKEN"
            - >
              hive schema:check "$SCHEMA_PATH" --target
              "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" --service "$SERVICE_NAME" --commit
              "$BITBUCKET_COMMIT" --author "$(git log -1 --format='%an <%ae>')" --contextId
              "$BITBUCKET_REPO_FULL_NAME#$BITBUCKET_PR_ID"
  branches:
    main:
      - step:
          name: Hive schema publish
          script:
            - curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
            - export HIVE_TOKEN="$HIVE_PUBLISH_TOKEN"
            - >
              hive schema:publish "$SCHEMA_PATH" --target
              "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" --service "$SERVICE_NAME" --url
              "$SERVICE_URL" --commit "$BITBUCKET_COMMIT" --author "$(git log -1 --format='%an
              <%ae>')" --fail-on-composition-error
```

- **Flow B:** Bitbucket Cloud merge queues run the pipeline under the `merge-queues:` selector on a
  temporary merge result commit. Bitbucket does not document which variables identify the queued
  pull request or the commit the entry is built on, so a Hive check with `--baseline` cannot be set
  up reliably there. Use flow A or C.
- **Flow C:** push in the `main` branch pipeline with `--revision "$BITBUCKET_COMMIT"`, and publish
  by revision in the deployment step.
- **Flow D:** add a step to the pull request pipeline after the check that sources
  `scripts/hive-preview.sh` (copied from this skill into the repository) and runs
  `hive_preview_publish` with `PR_NUMBER=$BITBUCKET_PR_ID`. Bitbucket has no "pull request merged"
  trigger, so clean up in the `main` pipeline if the merge commit message contains the pull request
  number, and delete stale `pr-*` targets with a scheduled pipeline.

## Buildkite

- Store tokens with Buildkite secrets or set them in an agent hook, not in the pipeline file. See
  https://buildkite.com/docs/pipelines/security/secrets/managing
- `BUILDKITE_PULL_REQUEST` is the pull request number, or `false` when the build is not for a pull
  request.
- Before checkout, `BUILDKITE_COMMIT` can be a symbolic name such as `HEAD`, so read the commit from
  git.
- The install script needs root or passwordless sudo, which self-hosted agents often do not have. On
  those agents, run the Hive steps in the CLI image (see Install in `commands.md`), for example with
  the Docker plugin, overriding the image's `hive` entrypoint.

| Hive variable | Buildkite value                                           |
| ------------- | --------------------------------------------------------- |
| `COMMIT`      | `$(git rev-parse HEAD)`                                   |
| `AUTHOR`      | `$BUILDKITE_BUILD_AUTHOR <$BUILDKITE_BUILD_AUTHOR_EMAIL>` |
| `CONTEXT_ID`  | `$BUILDKITE_PIPELINE_SLUG#$BUILDKITE_PULL_REQUEST`        |
| `PR_NUMBER`   | `$BUILDKITE_PULL_REQUEST`                                 |

Run the check only when `BUILDKITE_PULL_REQUEST` is not `false`, and the publish in a step limited
to the default branch (`branches: main`). Merge queues come from the Git host: for GitHub
repositories, run the queue check with GitHub Actions. For flow D, source `scripts/hive-preview.sh`
and run `hive_preview_publish` after the check; clean up targets the same way as for Bitbucket
Pipelines, or with GitHub Actions for GitHub repositories.

## Any other CI system

1. **Install** the CLI at a pinned version (install script, CLI image, or `devDependencies`). The
   install script needs root or passwordless sudo. Where the job has neither, use the CLI image.
2. **Token:** keep it in the CI system's secret store and expose it as `HIVE_TOKEN` only to the
   steps that need it. For self-hosted Hive, set `HIVE_REGISTRY`.
3. **Map the variables:** find the CI system's predefined variables for the commit SHA, the commit
   author and the pull request number. Set `COMMIT`, `AUTHOR` (or use
   `git log -1 --format='%an <%ae>'`), `CONTEXT_ID` (`<repository>#<pull request number>`) and
   `PR_NUMBER`.
4. **Wire the flow** with the commands from `commands.md`: the check in pull request builds, and
   publish (or push and publish by revision) on the default branch. For flow D, copy
   `scripts/hive-preview.sh` into the repository and run `hive_preview_publish` after the check.
5. **Gate:** make sure a non-zero exit code of any Hive step fails the build.
6. **Merge queue:** set up flow B only if the CI system provides the queue entry's base commit and
   the pull request's identity. Otherwise use flow A or C.
7. **Preview cleanup:** delete flow D targets on the Git host's "pull request merged" event where it
   exists (for example with GitHub Actions or GitLab environments). Otherwise use the merge commit
   message in the default-branch build, plus a scheduled job for stale `pr-*` targets.
