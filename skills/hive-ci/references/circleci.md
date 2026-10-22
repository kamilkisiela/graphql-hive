# CircleCI

Use the commands from `commands.md`. This file maps CircleCI's variables onto them.

## Contents

- Secrets and variables
- Install
- Flow A: check pull requests, publish on merge
- Flow B: merge queue
- Flow C: push on merge, publish at deploy time
- Flow D: preview target per pull request

## Secrets and variables

- Store tokens as project environment variables or in a context, and attach the context to the jobs
  that need it.
- `CIRCLE_PULL_REQUEST` is the pull request URL. It is only set for GitHub and Bitbucket Cloud
  projects, and only when the pipeline is associated with a pull request. `CIRCLE_PR_NUMBER` is only
  set for pull requests from forks, so derive the number from the URL.
- Pass `--commit`, `--author` and `--contextId` explicitly:

| Hive variable | CircleCI value                                                                          |
| ------------- | --------------------------------------------------------------------------------------- |
| `COMMIT`      | `$CIRCLE_SHA1`                                                                          |
| `AUTHOR`      | `$(git log -1 --format='%an <%ae>')` after `checkout` (CircleCI has no author variable) |
| `CONTEXT_ID`  | `$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME#${CIRCLE_PULL_REQUEST##*/}`          |
| `PR_NUMBER`   | `${CIRCLE_PULL_REQUEST##*/}`                                                            |

## Install

Use an image with curl and git, such as `cimg/base:current`. The `cimg` images have passwordless
sudo, so the install script (see Install in `commands.md`) works in the step that runs the CLI.

## Flow A: check pull requests, publish on merge

```yaml
# .circleci/config.yml
version: 2.1

executors:
  hive:
    docker:
      - image: cimg/base:current
    environment:
      HIVE_CLI_VERSION: 0.66.0 # pin to the current release
      HIVE_ORGANIZATION: my-organization
      HIVE_PROJECT: my-project
      HIVE_TARGET: development
      SCHEMA_PATH: schema.graphql
      SERVICE_NAME: products # Federation and stitching only
      SERVICE_URL: https://products.example.com/graphql # Federation and stitching only

jobs:
  hive-check:
    executor: hive
    steps:
      - checkout
      - run:
          name: Hive schema check
          command: |
            if [ -z "$CIRCLE_PULL_REQUEST" ]; then
              echo "Not a pull request build, skipping the Hive check."
              exit 0
            fi
            curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
            export HIVE_TOKEN="$HIVE_CHECK_TOKEN"
            hive schema:check "$SCHEMA_PATH" \
              --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
              --service "$SERVICE_NAME" \
              --commit "$CIRCLE_SHA1" \
              --author "$(git log -1 --format='%an <%ae>')" \
              --contextId "$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME#${CIRCLE_PULL_REQUEST##*/}"

  hive-publish:
    executor: hive
    steps:
      - checkout
      - run:
          name: Hive schema publish
          command: |
            curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
            export HIVE_TOKEN="$HIVE_PUBLISH_TOKEN"
            hive schema:publish "$SCHEMA_PATH" \
              --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
              --service "$SERVICE_NAME" \
              --url "$SERVICE_URL" \
              --commit "$CIRCLE_SHA1" \
              --author "$(git log -1 --format='%an <%ae>')" \
              --fail-on-composition-error

workflows:
  hive:
    jobs:
      - hive-check:
          context: hive
          filters:
            branches:
              ignore: main
      - hive-publish:
          context: hive
          filters:
            branches:
              only: main
```

## Flow B: merge queue

CircleCI does not receive the queue's base commit or the pull request, so use flow A or C. For
GitHub repositories that use GitHub's merge queue, run the queue check with GitHub Actions (see
`github-actions.md`).

## Flow C: push on merge, publish at deploy time

In a job on `main`, run the "push" command from `commands.md` with `--revision "$CIRCLE_SHA1"`. In
the deploy job, after the service is live, run the "publish at deploy time" command with the same
commit and the author from `git log`.

## Flow D: preview target per pull request

Add a job that `requires: [hive-check]`, runs on the same branches, sources
`scripts/hive-preview.sh` (copied from this skill into the repository) and runs
`hive_preview_publish` with `PR_NUMBER` from the table above.

CircleCI has no "pull request merged" trigger. For GitHub repositories, run the cleanup as a GitHub
Actions workflow on `pull_request: closed` (see `github-actions.md`). Otherwise, clean up in the
`main` build if the merge commit message contains the pull request number (GitHub's defaults are
`Merge pull request #<number> ...` and, for squash merges, `... (#<number>)`), and delete stale
`pr-*` targets with a scheduled pipeline.
