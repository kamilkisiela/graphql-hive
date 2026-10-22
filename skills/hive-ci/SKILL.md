---
name: hive-ci
description: >
  Sets up GraphQL Hive schema checks and schema publishing in CI/CD pipelines with the Hive CLI
  (schema:check, schema:publish, schema:push) on GitHub Actions, GitLab CI/CD, Azure Pipelines,
  CircleCI, Jenkins, Bitbucket Pipelines, Buildkite or any other CI system. Use when adding Hive
  schema checks or publishing to a pipeline, choosing a CI flow (simple, merge queue, deploy-gated,
  or a preview target per pull request), configuring HIVE_TOKEN, targets or a self-hosted registry
  in CI, gating merges or deploys on Hive results, or fixing a failing Hive CLI step in CI.
license: MIT
compatibility: '@graphql-hive/cli 0.66.0 or later'
metadata:
  author: graphql-hive
  version: '1.0.0'
allowed-tools: Bash(hive:*) Bash(npx:*) Bash(git:*) Read Write Edit Glob Grep WebFetch
---

# Hive schema registry in CI

Schema checks on pull requests, and publishing when changes are merged or deployed, on any CI
system. [references/](references/) holds the shared commands and one file per CI system, and
[scripts/hive-preview.sh](scripts/hive-preview.sh) the helpers for preview targets (flow D).

## Sources of truth

Hive's documentation changes. Fetch these pages instead of relying on memory, and never write a flag
that you have not confirmed in the CLI command reference.

| Need                                 | Source                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| CI/CD guide (read first)             | https://the-guild.dev/graphql/hive/docs/other-integrations/ci-cd                                        |
| CLI command reference                | https://github.com/graphql-hive/console/blob/main/packages/libraries/cli/README.md#commands             |
| Error codes and exit codes           | https://the-guild.dev/graphql/hive/docs/api-reference/cli#errors                                        |
| Schema registry concepts             | https://the-guild.dev/graphql/hive/docs/schema-registry                                                 |
| Creating an access token             | https://the-guild.dev/graphql/hive/docs/schema-registry/management/access-tokens#create-an-access-token |
| Public GraphQL API (preview targets) | https://the-guild.dev/graphql/hive/docs/api-reference/graphql-api                                       |
| Self-hosted Hive: CLI configuration  | https://the-guild.dev/graphql/hive/docs/schema-registry/self-hosting/client-and-cli-configuration       |

Most Hive docs pages are also available as markdown by appending `.md` to the URL, which is easier
to read. The error codes page is the exception: its list only renders in the HTML page. The CLI
command reference is a GitHub page; its raw text is at
https://raw.githubusercontent.com/graphql-hive/console/main/packages/libraries/cli/README.md. It
describes the latest release; for an older pinned version, read the README at the tag
`@graphql-hive/cli@<version>`. Without web access, use `hive <command> --help` and the `README.md`
and `errors.json` files in the installed `@graphql-hive/cli` package, which match the installed
version.

## Workflow

Copy this checklist and check off each step as you complete it:

```
Hive CI setup:
- [ ] Step 1: Discover the project (read only)
- [ ] Step 2: Read the CI/CD guide
- [ ] Step 3: Offer the flow options, then ask
- [ ] Step 4: Token and target
- [ ] Step 5: Commit, author and context
- [ ] Step 6: Write the pipeline
- [ ] Step 7: Verify
```

### 1. Discover the project (read only)

- **CI system**, from its files: `.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`,
  `.circleci/config.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `.buildkite/`.
- **Schema source**: SDL files or globs, a build step that generates SDL (code-first), or a running
  service URL. The CLI command reference lists the supported inputs.
- **Project type**: single schema, Federation or schema stitching. Federation and stitching projects
  need `--service` (the service name), and publishing needs `--url` (the service's URL). Find both.
- **Delivery**: when services deploy (on merge, or in a separate deploy job), whether each pull
  request gets a preview environment, and whether the Git host uses a merge queue or merge train.
- **Registry**: Hive Cloud or self-hosted.

### 2. Read the CI/CD guide

Fetch https://the-guild.dev/graphql/hive/docs/other-integrations/ci-cd and follow it. Where the
guide and this skill disagree about a known CLI gap (see Exit codes and gating), follow this skill.

### 3. Offer the flow options, then ask

Present these options with a recommendation based on step 1, and ask the user to choose before
writing any pipeline files.

| Flow                                   | What runs                                                                                                    | Choose when                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **A. Simple** (default)                | Check when a pull request is opened or updated. Publish on merge to the default branch.                      | Services deploy on merge, and there is no merge queue.                   |
| **B. Merge queue**                     | A, plus a check in the merge queue with `--baseline` set to the queue's base commit.                         | The Git host batches pull requests in a merge queue.                     |
| **C. Deploy-gated**                    | Check on the pull request. `schema:push --revision` on merge. `schema:publish --revision` in the deploy job. | Deploys happen separately from merges (the CI/CD guide's revision flow). |
| **D. Preview target per pull request** | Check, then create a target for the pull request, promote the base version into it, and publish to it.       | Each pull request has a preview environment that reads its schema.       |

Notes for the options:

- **A** with a deploy job in the same pipeline: run the publish after the deploy job (for example
  with `needs`), so a failed deploy does not publish.
- **B** needs the queue's base commit, a checkout that contains it (full history), and the pull
  request's identity so that approved breaking changes still count. Of the CI systems covered here,
  only GitHub Actions (the `merge_group` event) provides all three. The other reference files say
  what is missing; recommend A or C there.
- **C** stores the schema at merge time and publishes it only when the service is live. The deploy
  job publishes by revision and does not need the schema file.
- **D** runs the check first and creates nothing if it fails. The pull request's target is deleted
  when the pull request is merged, and optionally when it is closed without merging. The helpers are
  in [scripts/hive-preview.sh](scripts/hive-preview.sh), described in
  [references/commands.md](references/commands.md).
- With several environments, follow the CI/CD guide's branch-to-target mapping, for example `main`
  to `development`.

### 4. Token and target

- Create one token per stage (check, publish, and push or preview where used) by following
  https://the-guild.dev/graphql/hive/docs/schema-registry/management/access-tokens#create-an-access-token.
  For CI, use a **project access token**. As a fallback, use an **organization access token scoped
  to the specific projects**.
- Grant only what each stage needs: `schemaCheck:create` to check, `schema:push` to push,
  `schemaVersion:publish` to publish, `schemaCheck:approve` for `--forceSafe`. Flow D also needs
  `target:create`, `target:delete` and `schemaVersion:promote`, granted on **all targets** of the
  project, because the pull request's target does not exist when the token is created.
- These tokens need `--target <organization>/<project>/<target>` (or a target ID) on every command.
  Without it, the command fails with error `[102]`.
- Store the token in the CI system's secret store and expose it to the step as `HIVE_TOKEN`. Do not
  pass it on the command line.
- Self-hosted Hive: set `HIVE_REGISTRY` (or `--registry.endpoint`) to the registry's GraphQL
  endpoint.
- Run `hive whoami` with the token to confirm its permissions. Without a token locally, list this as
  a follow-up for the user.

### 5. Commit, author and context

- With `--github` (GitHub Actions, with the Hive GitHub integration connected to the organization
  and the project linked to the repository), the integration provides the commit, the author and the
  pull request. Do not pass them.
- Everywhere else, pass `--commit` and `--author` explicitly on `schema:check` and `schema:publish`,
  using the CI system's variables from its reference file. Where a CI system has no author variable,
  use `git log -1 --format='%an <%ae>'` on the checked-out commit.
- For pull request checks without `--github`, pass `--contextId "<repository>#<PR number>"` so that
  breaking changes approved in Hive stay approved for later pushes to the same pull request.

### 6. Write the pipeline

Read [references/commands.md](references/commands.md) and the CI system's reference file in full,
then write the pipeline from them:

| CI system                                  | Reference file                                                 |
| ------------------------------------------ | -------------------------------------------------------------- |
| All CI systems (commands, API calls)       | [references/commands.md](references/commands.md)               |
| GitHub Actions                             | [references/github-actions.md](references/github-actions.md)   |
| GitLab CI/CD                               | [references/gitlab-ci.md](references/gitlab-ci.md)             |
| Azure Pipelines                            | [references/azure-pipelines.md](references/azure-pipelines.md) |
| CircleCI                                   | [references/circleci.md](references/circleci.md)               |
| Jenkins                                    | [references/jenkins.md](references/jenkins.md)                 |
| Bitbucket Pipelines, Buildkite, any other  | [references/other-ci.md](references/other-ci.md)               |
| Flow D helpers, copied into the repository | [scripts/hive-preview.sh](scripts/hive-preview.sh)             |

### 7. Verify

1. Validate the pipeline file with the CI system's linter, if one is available: `actionlint` for
   GitHub Actions, `circleci config validate` for CircleCI, GitLab's CI Lint (`glab ci lint` or the
   pipeline editor). Fix each error and validate again until it passes. If none is installed, say
   so.
2. If a token is available locally, run the check command once with the same arguments. On a
   failure, follow "Diagnose a failing step", fix the cause, and run it again.
3. Report the setup as done only when the pipeline file validates and each Hive step fails the job
   on a non-zero exit code. After the first CI run, confirm the gating on the run's log.

## Ground rules

- **ALWAYS** pin the CLI version, as the CI/CD guide describes.
- **ALWAYS** pass `--target`, and on Federation and stitching projects `--service` (plus `--url`
  when publishing).
- **NEVER** use the flags or variables listed under Old patterns.
- **NEVER** set `HIVE_REGISTRY` to an empty value, for example from an unset CI variable. The
  command then fails with `[105]` instead of using the Hive Cloud default. Set it only for
  self-hosted Hive.
- **NEVER** run `schema:delete` without `--confirm` or `--dryRun` in CI. Without them it prompts for
  confirmation, and when stdin is not interactive it aborts with exit code 0 and deletes nothing, so
  the job passes without doing anything.
- **NEVER** print full schemas into CI logs. `schema:fetch` writes files with `--write`.
- **PREFER** `--experimentalJsonFile <path>` on `schema:check` when a later step needs the result as
  JSON.

## Exit codes and gating

The exit codes and every error code are documented at
https://the-guild.dev/graphql/hive/docs/api-reference/cli#errors. Gate each step on a non-zero exit
code, with these gaps in CLI 0.66.0:

- `schema:publish` exits with 0 when it stores a Federation version that does not compose. Add
  `--fail-on-composition-error` so that the job fails instead.
- `schema:publish --github` exits with 0 when the publish is rejected; the result is only shown on
  the GitHub check run. Leave out `--github` on a publish step whose result must fail the job, and
  pass `--commit` and `--author` instead.
- A timeout means the operation may still have completed. Check the result in Hive before retrying.

## Old patterns

| Do not use                                                            | Use instead                              | Why                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--registry`                                                          | `--registry.endpoint` or `HIVE_REGISTRY` | Deprecated.                                                                                             |
| `--token`                                                             | `--registry.accessToken` or `HIVE_TOKEN` | Deprecated.                                                                                             |
| `HIVE_ENDPOINT`                                                       | `HIVE_REGISTRY`                          | The CLI ignores it and reads `HIVE_REGISTRY`. Earlier versions of the CI/CD guide used `HIVE_ENDPOINT`. |
| `--force`, `--experimental_acceptBreakingChanges` on `schema:publish` | Nothing; remove them.                    | The CLI reports both as deprecated.                                                                     |

## Diagnose a failing step

1. Every error message ends with its code in brackets, for example `[124]`. Look up the cause and
   fix at https://the-guild.dev/graphql/hive/docs/api-reference/cli#errors instead of guessing. The
   message itself names the missing argument or the denied permission; with a project or
   organization access token, a missing `--target` is the usual cause (step 4).
2. For permission errors, run `hive whoami` with the same `HIVE_TOKEN` and `HIVE_REGISTRY`.
3. Check the flags against the CLI command reference. A flag that is not listed there does not
   exist.
4. Before rewriting the command, read [references/commands.md](references/commands.md) and the CI
   system's reference file (step 6).
