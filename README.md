[![GraphQL Conf 2023](/GraphQLConf-2023-Banner.png)](https://graphql.org/conf/)

# GraphQL Hive

GraphQL Hive provides all the tools the get visibility of your GraphQL architecture at all stages,
from standalone APIs to composed schemas (Federation, Stitching).

- Visit [graphql-hive.com](https://graphql-hive.com)
  ([status page](https://status.graphql-hive.com))
- [Read the announcement blog post](https://the-guild.dev/blog/announcing-graphql-hive-public)
- [Read the docs](https://docs.graphql-hive.com)

## Built for the community, for all GraphQL APIs

GraphQL Hive has been built with 3 main objectives in mind:

- **Help GraphQL developers to get to know their GraphQL APIs** a little more with our Schema
  Registry, Performance Monitoring, Alerts, and Integrations.
- **Support all kinds of GraphQL APIs**, from Federation, and Stitching, to standalone APIs.
- **Open Source at the heart**: 100% open-source and build in public with the community.
- **A plug and play Cloud solution**: to give access to Hive to most people with a generous free
  "Hobby plan"

## Features Overview

### Schema Registry

GraphQL Hive offers 3 useful features to manage your GraphQL API:

- **Prevent breaking changes** - GraphQL Hive will run a set of checks and notify your team via
  Slack, GitHub, or within the application.
- **Data-driven** definition of a “breaking change” based on Operations Monitoring.
- **History of changes** - an access to the full history of changes, even on a complex composed
  schema (Federation, Stitching).
- **High-availability and multi-zone CDN** service based on Cloudflare to access Schema Registry

### Monitoring

Once a Schema is deployed, **it is important to be aware of how it is used and what is the
experience of its final users**.

## Self-hosted

GraphQL Hive is completely open-source under the MIT license, meaning that you are free to host on
your own infrastructure.

GraphQL Hive helps you get a global overview of the usage of your GraphQL API with:

- Error rates and repartition
- Global and queries performances (latency, RPM…)
- Operations count
- Active GraphQL clients

### Integrations

GraphQL Hive is well integrated with **Slack** and most **CI/CD** systems to get you up and running
as smoothly as possible!

GraphQL Hive can notify your team when schema changes occur, either via Slack or a custom webhook.

Also, the Hive CLI allows integration of the schema checks mechanism to all CI/CD systems (GitHub,
BitBucket, Azure, and others). The same applies for schema publishing and operations checks.

If you are using GitHub, you can directly benefit from the **GraphQL Hive app that will
automatically add status checks to your PRs**!

### Join us in building the future of GraphQL Hive

Like all [The Guild](https://the-guild.dev) projects, GraphQL Hive is built with the community.

We can't wait to get you onboard and get your feedback, pull requests, and feature requests.

See you in Hive! 🐝

## Project Stack

- General: NodeJS, TypeScript
- Authentication: SuperTokens
- HTTP Server: Fastify
- APIs: GraphQL, GraphQL-Yoga, GraphQL-Codegen, GraphQL-Inspector, GraphQL-Modules
- App: React, Next.js, Tailwind CSS, Radix Primitives
- CLI: Oclif
- Deployment (Cloud): Pulumi, K8s, Contour (Envoy), Azure Cloud, CloudFlare Workers, CloudFlare R2
- Monitoring: Prometheus, Grafana, Sentry
- Databases: Postgres, Redis, ClickHouse

## Docs

- [Development](./docs/DEVELOPMENT.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Testing](./docs/TESTING.md)
