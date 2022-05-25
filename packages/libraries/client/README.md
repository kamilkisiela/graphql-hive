# GraphQL Hive Client

[GraphQL Hive](https://graphql-hive.com) is a GraphQL schemas registry where you can host, manage and collaborate on all your GraphQL schemas and operations, compatible with all architecture: schema stitching, federation, or just a good old monolith.

GraphQL Hive is currently available as a hosted service to be used by all.
We take care of the heavy lifting behind the scenes be managing the registry, scaling it for your needs, to free your time to focus on the most important things at hand.

### Installation

```
npm install @graphql-hive/client
```

### Usage

Hive Client comes with generic client and plugins for [Envelop](https://envelop.dev) and [Apollo Server](https://github.com/apollographql/apollo-server)

#### With Envelop

If you're not familiar with Envelop - in "short" it's a lightweight JavaScript library for wrapping GraphQL execution layer and flow, allowing developers to develop, share and collaborate on GraphQL-related plugins, while filling the missing pieces in GraphQL implementations.

Here's [more](https://github.com/dotansimha/envelop#envelop) on that topic.

```ts
import { envelop } from '@envelop/core'
import { useHive } from '@graphql-hive/client'

const envelopProxy = envelop({
  plugins: [
    useHive({
      enabled: true, // Enable/Disable Hive Client
      debug: true, // Debugging mode
      token: 'YOUR-TOKEN',
      // Schema reporting
      reporting: {
        // feel free to set dummy values here
        author: 'Author of the schema version',
        commit: 'git sha or any identifier'
      },
      usage: true // Collects schema usage based on operations
    })
  ]
})
```

#### With Apollo Server

Thanks to the plugin system it's a matter of adding hiveApollo plugin to ApolloServer instance:

```ts
import { ApolloServer } from 'apollo-server'
import { hiveApollo } from '@graphql-hive/client'

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [
    hiveApollo({
      enabled: true, // Enable/Disable Hive Client
      debug: true, // Debugging mode
      token: 'YOUR-TOKEN',
      reporting: {
        // feel free to set dummy values here
        author: 'Author of the latest change',
        commit: 'git sha or any identifier'
      },
      usage: true // Collects schema usage based on operations
    })
  ]
})
```

#### With Other Servers

First you need to instantiate the Hive Client.

The `collectUsage` method accepts the same arguments as execute function of graphql-js and returns a function that expects the execution result object.

- `collectUsage(args)` - should be called when a GraphQL execution starts.
- `finish(result)` (function returned by `collectUsage(args)`) - has to be invoked right after execution finishes.

```ts
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { createHive } from '@graphql-hive/client';

const app = express();
const hive = createHive({
  enabled: true, // Enable/Disable Hive Client
  debug: true, // Debugging mode
  token: 'YOUR-TOKEN',
  reporting: {
  // feel free to set dummy values here
    author: 'Author of the latest change',
    commit: 'git sha or any identifier',
  },
  usage: true, // Collects schema usage based operations
  },
});

// Report Schema
hive.reportSchema({ schema: yourSchema });

app.post("/graphql", graphqlHTTP({
  schema: yourSchema,
  async customExecuteFn(args) {
    // Collecting usage
    const finish = hive.collectUsage(args);
    const result = await execute(args);
    finish(result);
    return result;
  }
}));
```

#### Using the registry when Stitching

Stitching could be done in many ways, that's why `@graphql-hive/client` provide generic functions, not something dedicated for stitching. Unfortunately the implementation of gateway + polling is up to you.

Prerequisites:

- `HIVE_CDN_ENDPOINT` - the endpoint Hive generated for you in the previous step
- `HIVE_CDN_KEY` - the access key

The `createServicesFetcher` factory function returns another function that is responsible for fetching a list of services from Hive's high-availability endpoint.

```ts
import { createServicesFetcher } from '@graphql-hive/client'

const fetchServices = createServicesFetcher({
  endpoint: process.env.HIVE_CDN_ENDPOINT,
  key: process.env.HIVE_CDN_KEY
})

// This is your GraphQL gateway with built-in polling mechanism, in which the `stitchServices` method is called every 10 seconds.
startMyGraphQLGateway({
  // a function that resolves a list of services to stitch them together
  async stitchServices() {
    const services = await fetchServices()

    return services.map(service => {
      return {
        sdl: service.sdl,
        url: service.url,
        checksum: service.id // to check if service's schema was modified
      }
    })
  },
  pollingInSec: 10 // every 10s
})
```

#### Using the registry with Apollo Gateway

You can connect your Apollo Gateway with Hive client.

The `experimental_pollInterval` value is up to you. Apollo Gateway uses 10s (10_000 ms) by default but we think it's better to fetch a supergraph more often.

- `HIVE_CDN_ENDPOINT` - the endpoint Hive generated for you in the previous step
- `HIVE_CDN_KEY` - the access

```ts
import { createSupergraphSDLFetcher } from '@graphql-hive/client'
import { ApolloGateway } from '@apollo/gateway'
import { ApolloServer } from 'apollo-server'

const gateway = new ApolloGateway({
  experimental_pollInterval: 10_000, // define the poll interval (in ms)
  experimental_updateSupergraphSdl: createSupergraphFetcher({
    endpoint: HIVE_CDN_ENDPOINT,
    key: HIVE_CDN_KEY
  })
})

const server = new ApolloServer({
  gateway
})

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})
```
