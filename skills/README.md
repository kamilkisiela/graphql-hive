# Hive agent skills

Agent skills that teach coding agents how to use GraphQL Hive. They follow the
[Agent Skills](https://skills.sh) format: each skill is a folder with a `SKILL.md` and optional
`references/`, `scripts/` and `evals/`.

| Skill                  | Use it for                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`hive-ci`](./hive-ci) | Setting up Hive schema checks and publishing in CI/CD on GitHub Actions, GitLab CI/CD, Azure Pipelines, CircleCI, Jenkins, Bitbucket Pipelines, Buildkite or any other CI system. |

## Install

```sh
npx skills add graphql-hive/console --skill hive-ci
```

The skills link to the Hive documentation instead of copying it, so an agent always reads the
current CLI commands, error codes and CI/CD guide.

## Evals

Each skill's `evals/` folder holds scenarios in the shape recommended by the
[skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):
a `query`, and the `expected_behavior` to check by hand. There is no runner; give the query to an
agent with the skill loaded and compare its behaviour with the list.
