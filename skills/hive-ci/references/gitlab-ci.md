# GitLab CI/CD

Use the commands from `commands.md`. This file maps GitLab's variables onto them.

## Contents

- Secrets and variables
- Install
- Flow A: check merge requests, publish on merge
- Flow B: merge trains
- Flow C: push on merge, publish at deploy time
- Flow D: preview target per merge request

## Secrets and variables

- Store tokens as masked CI/CD variables in the project or group settings. Protected variables are
  only available to pipelines on protected branches, so keep the check token unprotected (it runs in
  merge request pipelines) and protect the publish token.
- The checks run in merge request pipelines. Pass `--commit`, `--author` and `--contextId`
  explicitly:

| Hive variable | GitLab value                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `COMMIT`      | `${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-$CI_COMMIT_SHA}` (merged results pipelines build a merge commit) |
| `AUTHOR`      | `$CI_COMMIT_AUTHOR` (already in `Name <email>` format)                                                  |
| `CONTEXT_ID`  | `$CI_PROJECT_PATH#$CI_MERGE_REQUEST_IID`                                                                |
| `PR_NUMBER`   | `$CI_MERGE_REQUEST_IID`                                                                                 |

## Install

Use the CLI image at a pinned version (see Install in `commands.md`). GitLab runs the job script in
a shell, so override the image's `hive` entrypoint:

```yaml
.hive:
  image:
    name: ghcr.io/graphql-hive/cli:0.66.0 # pin to the current release
    entrypoint: ['']
```

## Flow A: check merge requests, publish on merge

```yaml
variables:
  HIVE_ORGANIZATION: my-organization
  HIVE_PROJECT: my-project
  HIVE_TARGET: development
  SCHEMA_PATH: schema.graphql
  SERVICE_NAME: products # Federation and stitching only
  SERVICE_URL: https://products.example.com/graphql # Federation and stitching only

hive-check:
  extends: .hive
  rules:
    - if: $CI_MERGE_REQUEST_EVENT_TYPE == "merge_train"
      when: never
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - export HIVE_TOKEN="$HIVE_CHECK_TOKEN"
    - export COMMIT="${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-$CI_COMMIT_SHA}"
    - export AUTHOR="$CI_COMMIT_AUTHOR"
    - export CONTEXT_ID="$CI_PROJECT_PATH#$CI_MERGE_REQUEST_IID"
    - >
      hive schema:check "$SCHEMA_PATH" --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET"
      --service "$SERVICE_NAME" --commit "$COMMIT" --author "$AUTHOR" --contextId "$CONTEXT_ID"

hive-publish:
  extends: .hive
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - export HIVE_TOKEN="$HIVE_PUBLISH_TOKEN"
    - >
      hive schema:publish "$SCHEMA_PATH" --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET"
      --service "$SERVICE_NAME" --url "$SERVICE_URL" --commit "$CI_COMMIT_SHA" --author
      "$CI_COMMIT_AUTHOR" --fail-on-composition-error
```

Without `stage:`, `hive-publish` runs in the first stage. When the pipeline has a deploy job, set
`stage: deploy` and `needs: [deploy]` so the schema is published only after a successful deploy.

## Flow B: merge trains

GitLab merge trains (Premium and Ultimate) run each merge request's pipeline on the target branch
combined with every earlier merge request in the train. A Hive check there needs `--baseline` set to
the commit the train entry is built on, but GitLab does not document a variable for that commit.
Without it, the check compares the whole train against the registry, and can report breaking changes
from earlier merge requests. Therefore:

- keep the Hive check out of merge train pipelines (the `merge_train` rule in flow A);
- use flow A or C, and rely on the merge request pipeline's check.

## Flow C: push on merge, publish at deploy time

```yaml
hive-push:
  extends: .hive
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - export HIVE_TOKEN="$HIVE_PUSH_TOKEN"
    - >
      hive schema:push "$SCHEMA_PATH" --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET"
      --service "$SERVICE_NAME" --revision "$CI_COMMIT_SHA"
```

In the deploy job, after the service is live, run the "publish at deploy time" command from
`commands.md` with `COMMIT="$CI_COMMIT_SHA"` and `AUTHOR="$CI_COMMIT_AUTHOR"`.

## Flow D: preview target per merge request

Use a review environment. With merge request pipelines, GitLab runs the environment's `on_stop` job
automatically when the merge request is merged or closed, which deletes the target. Copy
`scripts/hive-preview.sh` from this skill into the repository. The CLI image has no curl, so install
it:

```yaml
hive-preview:
  extends: .hive
  needs: [hive-check]
  rules:
    - if: $CI_MERGE_REQUEST_EVENT_TYPE == "merge_train"
      when: never
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  resource_group: hive-preview-$CI_MERGE_REQUEST_IID
  environment:
    name: hive-preview/$CI_MERGE_REQUEST_IID
    on_stop: hive-preview-cleanup
  script:
    - apt-get update && apt-get install -y --no-install-recommends curl
    - export HIVE_TOKEN="$HIVE_PREVIEW_TOKEN" PR_NUMBER="$CI_MERGE_REQUEST_IID"
    - export COMMIT="${CI_MERGE_REQUEST_SOURCE_BRANCH_SHA:-$CI_COMMIT_SHA}"
      AUTHOR="$CI_COMMIT_AUTHOR"
    - . scripts/hive-preview.sh
    - hive_preview_publish

hive-preview-cleanup:
  extends: .hive
  rules:
    - if: $CI_MERGE_REQUEST_EVENT_TYPE == "merge_train"
      when: never
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
  resource_group: hive-preview-$CI_MERGE_REQUEST_IID
  environment:
    name: hive-preview/$CI_MERGE_REQUEST_IID
    action: stop
  script:
    - apt-get update && apt-get install -y --no-install-recommends curl
    - export HIVE_TOKEN="$HIVE_PREVIEW_TOKEN" PR_NUMBER="$CI_MERGE_REQUEST_IID"
    - . scripts/hive-preview.sh
    - if preview_target_exists; then delete_preview_target; fi
```

Because GitLab runs the stop job both when a merge request is merged and when it is closed, targets
of abandoned merge requests are cleaned up too.
