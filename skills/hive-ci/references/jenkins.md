# Jenkins

Use the commands from `commands.md`. This file maps Jenkins' variables onto them. The examples use a
declarative multibranch pipeline.

## Contents

- Secrets and variables
- Install
- Flow A: check pull requests, publish on merge
- Flow B: merge queue
- Flow C: push on merge, publish at deploy time
- Flow D: preview target per pull request

## Secrets and variables

- Store tokens as "Secret text" credentials, and bind them in the stage that needs them with
  `environment { HIVE_TOKEN = credentials('hive-check-token') }` or `withCredentials`.
- Use single-quoted `sh '''...'''` steps. With double quotes, Groovy interpolates the secret into
  the command before the shell runs it.
- In multibranch pipelines, pull request builds set `CHANGE_ID` (the pull request number). Pass
  `--commit`, `--author` and `--contextId` explicitly:

| Hive variable | Jenkins value                                                                           |
| ------------- | --------------------------------------------------------------------------------------- |
| `COMMIT`      | `$GIT_COMMIT`                                                                           |
| `AUTHOR`      | `$CHANGE_AUTHOR` in pull request builds, otherwise `$(git log -1 --format='%an <%ae>')` |
| `CONTEXT_ID`  | `<repository>#$CHANGE_ID`, with the repository name set in the Jenkinsfile              |
| `PR_NUMBER`   | `$CHANGE_ID`                                                                            |

## Install

Run on an agent with curl and git, and use the install script (see Install in `commands.md`). It
needs root or passwordless sudo, which many Jenkins agents do not have. On those agents, run each
Hive stage in the CLI image instead, and drop the install line from the stage. The `--entrypoint=`
argument clears the image's `hive` entrypoint, so Jenkins can keep the container running:

```groovy
stage('Hive schema check') {
  agent {
    docker {
      image 'ghcr.io/graphql-hive/cli:0.66.0' // pin to the current release
      args '--entrypoint='
    }
  }
  // ... the rest of the stage from flow A, without the curl install line
}
```

A stage-level `docker` agent needs a node that can run Docker-based pipelines.

## Flow A: check pull requests, publish on merge

```groovy
// Jenkinsfile
pipeline {
  agent any

  environment {
    HIVE_CLI_VERSION = '0.66.0' // pin to the current release
    HIVE_ORGANIZATION = 'my-organization'
    HIVE_PROJECT = 'my-project'
    HIVE_TARGET = 'development'
    HIVE_REPOSITORY = 'my-organization/my-repository'
    SCHEMA_PATH = 'schema.graphql'
    SERVICE_NAME = 'products' // Federation and stitching only
    SERVICE_URL = 'https://products.example.com/graphql' // Federation and stitching only
  }

  stages {
    stage('Hive schema check') {
      when { changeRequest() }
      environment {
        HIVE_TOKEN = credentials('hive-check-token')
      }
      steps {
        sh '''
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          hive schema:check "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --commit "$GIT_COMMIT" \
            --author "${CHANGE_AUTHOR:-$(git log -1 --format='%an <%ae>')}" \
            --contextId "$HIVE_REPOSITORY#$CHANGE_ID"
        '''
      }
    }

    stage('Hive schema publish') {
      when { branch 'main' }
      environment {
        HIVE_TOKEN = credentials('hive-publish-token')
      }
      steps {
        sh '''
          curl -sSL https://graphql-hive.com/install.sh | sh -s "$HIVE_CLI_VERSION"
          hive schema:publish "$SCHEMA_PATH" \
            --target "$HIVE_ORGANIZATION/$HIVE_PROJECT/$HIVE_TARGET" \
            --service "$SERVICE_NAME" \
            --url "$SERVICE_URL" \
            --commit "$GIT_COMMIT" \
            --author "$(git log -1 --format='%an <%ae>')" \
            --fail-on-composition-error
        '''
      }
    }
  }
}
```

## Flow B: merge queue

Jenkins does not receive the queue's base commit or the pull request, so use flow A or C. For GitHub
repositories that use GitHub's merge queue, run the queue check with GitHub Actions (see
`github-actions.md`).

## Flow C: push on merge, publish at deploy time

In a stage with `when { branch 'main' }`, run the "push" command from `commands.md` with
`--revision "$GIT_COMMIT"`. In the deploy stage or job, after the service is live, run the "publish
at deploy time" command with the same commit and the author from `git log`.

## Flow D: preview target per pull request

Add a stage after the check with `when { changeRequest() }` that sources `scripts/hive-preview.sh`
(copied from this skill into the repository) and runs `hive_preview_publish` with
`PR_NUMBER=$CHANGE_ID`. Add `options { disableConcurrentBuilds() }` so builds of the same pull
request run one at a time.

Multibranch pipelines do not build a pull request after it is merged. For GitHub repositories, run
the cleanup as a GitHub Actions workflow on `pull_request: closed` (see `github-actions.md`).
Otherwise, clean up in the `main` build if the merge commit message contains the pull request
number, and delete stale `pr-*` targets with a scheduled job.
