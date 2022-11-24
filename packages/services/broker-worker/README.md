## Hive Broker Worker

Idea here is to have a broker worker that can be used to make requests outside GraphQL Hive and
without any access to the internal network. This is very useful for example for making requests to
external APIs.

Look at [models.ts](./src/models.ts) to see the structure accepted payload.
