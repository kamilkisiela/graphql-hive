# GraphQL Hive - external composition

[GraphQL Hive](https://graphql-hive.com) is a GraphQL schemas registry where you can host, manage and collaborate on all your GraphQL schemas and operations, compatible with all architecture: schema stitching, federation, or just a good old monolith.

## Installation

```
npm install @graphql-hive/external-composition
```

## Usage

```javascript
import { verifyRequest, compose, signatureHeaderName } from '@graphql-hive/external-composition'
import { composeAndValidate, compositionHasErrors } from '@apollo/federation'

const SECRET = process.env.SECRET

const composeFederation = compose(services => {
  const result = composeAndValidate(
    services.map(service => {
      return {
        typeDefs: parse(service.sdl),
        name: service.name,
        url: service.url
      }
    })
  )

  if (compositionHasErrors(result)) {
    return {
      type: 'failure',
      result: {
        errors: result.errors.map(err => ({
          message: err.message
        }))
      }
    }
  } else {
    return {
      type: 'success',
      result: {
        supergraph: result.supergraphSdl,
        sdl: printSchema(result.schema)
      }
    }
  }
})

server.route({
  method: ['POST'],
  url: '/compose',
  handler(req, res) {
    const error = verifyRequest({
      body: JSON.stringify(req.body),
      signature: req.headers[signatureHeaderName],
      secret: SECRET
    })

    if (error) {
      // Failed to verify the request
      res.status(500).send(error)
    } else {
      const result = composeFederation(req.body)
      res.send(JSON.stringify(result))
    }
  }
})
```
