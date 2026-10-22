# Azure Pipelines

Use the commands from `commands.md`. This file maps Azure Pipelines' variables onto them.

## Contents

- Secrets and variables
- Install
- Flow A: check pull requests, publish on merge
- Flow B: merge queue
- Flow C: push on merge, publish at deploy time
- Flow D: preview target per pull request

## Secrets and variables

- Store tokens as secret pipeline variables or in a variable group (optionally linked to Azure Key
  Vault). **Secret variables are not passed to scripts automatically.** Map them into each step:

  ```yaml
  - bash: hive schema:check ...
    env:
      HIVE_TOKEN: $(HIVE_CHECK_TOKEN)
  ```

- Pull request builds: Azure Repos runs them through a build validation branch policy. GitHub and
  Bitbucket repositories use the `pr:` trigger. The pull request variables are only set in those
  builds.
- Pass `--commit`, `--author` and `--contextId` explicitly. In `bash` steps the variables are
  available as environment variables, for example `System.PullRequest.PullRequestId` as
  `$SYSTEM_PULLREQUEST_PULLREQUESTID`:

| Hive variable | Azure Pipelines value                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `COMMIT`      | `System.PullRequest.SourceCommitId` in Azure Repos pull request builds, otherwise `Build.SourceVersion`                             |
| `AUTHOR`      | `Build.RequestedFor` (the person who triggered the build)                                                                           |
| `CONTEXT_ID`  | `Build.Repository.Name` + `#` + `System.PullRequest.PullRequestId` (Azure Repos) or `System.PullRequest.PullRequestNumber` (GitHub) |
| `PR_NUMBER`   | `System.PullRequest.PullRequestId` (Azure Repos) or `System.PullRequest.PullRequestNumber` (GitHub)                                 |

## Install

Microsoft-hosted agents have curl and passwordless sudo, so the install script (see Install in
`commands.md`) works inside the step that runs the CLI.

## Flow A: check pull requests, publish on merge

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main]
pr: # GitHub and Bitbucket repositories. Azure Repos: add a build validation branch policy instead.
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

variables:
  HIVE_CLI_VERSION: 0.66.0 # pin to the current release
  HIVE_ORGANIZATION: my-organization
  HIVE_PROJECT: my-project
  HIVE_TARGET: development
  SCHEMA_PATH: schema.graphql
  SERVICE_NAME: products # Federation and stitching only
  SERVICE_URL: https://products.example.com/graphql # Federation and stitching only

jobs:
  - job: hive_check
    condition: eq(variables['Build.Reason'], 'PullRequest')
    steps:
      - checkout: self
      - bash: |
          set -e
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          PR_NUMBER="${SYSTEM_PULLREQUEST_PULLREQUESTNUMBER:-$SYSTEM_PULLREQUEST_PULLREQUESTID}"
          hive schema:check "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --commit "${SYSTEM_PULLREQUEST_SOURCECOMMITID:-$BUILD_SOURCEVERSION}" \
            --author "$BUILD_REQUESTEDFOR" \
            --contextId "$BUILD_REPOSITORY_NAME#$PR_NUMBER"
        displayName: Hive schema check
        env:
          HIVE_TOKEN: $(HIVE_CHECK_TOKEN)

  - job: hive_publish
    condition:
      and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'),
      ne(variables['Build.Reason'], 'PullRequest'))
    steps:
      - checkout: self
      - bash: |
          set -e
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          hive schema:publish "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --url "$SERVICE_URL" \
            --commit "$BUILD_SOURCEVERSION" \
            --author "$BUILD_REQUESTEDFOR" \
            --fail-on-composition-error
        displayName: Hive schema publish
        env:
          HIVE_TOKEN: $(HIVE_PUBLISH_TOKEN)
```

## Flow B: merge queue

Azure Repos has no merge queue, and Azure Pipelines does not receive the queue's base commit or the
pull request, so use flow A or C. For GitHub repositories that use GitHub's merge queue, run the
queue check with GitHub Actions (see `github-actions.md`).

## Flow C: push on merge, publish at deploy time

On `main`, run the "push" command from `commands.md` with `--revision "$BUILD_SOURCEVERSION"`. In
the deployment stage, after the service is live, run the "publish at deploy time" command with
`COMMIT` set to the same `Build.SourceVersion` and `AUTHOR` to `Build.RequestedFor`. Map the tokens
into each step with `env:`.

## Flow D: preview target per pull request

Add a job that runs after `hive_check` in pull request builds (`dependsOn: hive_check`), sources
`scripts/hive-preview.sh` (copied from this skill into the repository) and runs
`hive_preview_publish` with `PR_NUMBER` from the table above.

Azure Pipelines has no "pull request merged" trigger. Clean up in the `main` build that runs after
the merge. Azure Repos' default merge commit message starts with `Merged PR <id>:`:

```yaml
- bash: |
    PR_NUMBER=$(git log -1 --format=%s | sed -n 's/^Merged PR \([0-9]*\):.*/\1/p')
    if [ -n "$PR_NUMBER" ]; then
      . scripts/hive-preview.sh
      if preview_target_exists; then delete_preview_target; fi
    fi
  displayName: Delete the Hive preview target
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  env:
    HIVE_TOKEN: $(HIVE_PREVIEW_TOKEN)
```

This depends on the merge commit message containing the pull request ID. Azure Repos can be set to
leave it out; in that case, or for pull requests that are abandoned, delete stale `pr-*` targets
with a scheduled pipeline.
