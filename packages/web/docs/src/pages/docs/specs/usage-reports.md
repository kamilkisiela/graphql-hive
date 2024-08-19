# Usage Reporting

The official JavaScript Hive Client (`@graphql-hive/core`) collects executed operations and sends
them in batches (as a single report, when a buffer is full or every few seconds) over HTTP.

> It's recommended to send a report for more than 1 operation. The maximum payload size is 1 MB.

| Name                 | Value                                |
| -------------------- | ------------------------------------ |
| Endpoint             | `https://app.graphql-hive.com/usage` |
| Authorization Header | `Authorization: Bearer token-here`   |
| API version Header   | `X-Usage-API-Version: 2`             |
| Method               | `POST`                               |

## Data structure

<details>
  <summary>TypeScript schema</summary>

```typescript
export interface Report {
  size: number
  map: {
    [k: string]: OperationMapRecord
  }
  operations?: RequestOperation[]
  subscriptionOperations?: SubscriptionOperation[]
}

export interface OperationMapRecord {
  operation: string
  operationName?: string
  /**
   * @minItems 1
   */
  fields: [string, ...string[]]
}

export interface RequestOperation {
  timestamp: number
  operationMapKey: string
  execution: Execution
  metadata?: Metadata
  persistedDocumentHash?: string
}

export interface Execution {
  ok: boolean
  duration: number
  errorsTotal: number
}

export interface SubscriptionOperation {
  timestamp: number
  operationMapKey: string
  metadata?: Metadata
}

export interface Client {
  name: string
  version: string
}

export interface Metadata {
  client?: Client
}
```

</details>

<details>
  <summary>JSON Schema</summary>

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Report",
  "additionalProperties": false,
  "type": "object",
  "properties": {
    "size": {
      "type": "integer"
    },
    "map": {
      "type": "object",
      "patternProperties": {
        "^(.*)$": {
          "title": "OperationMapRecord",
          "additionalProperties": false,
          "type": "object",
          "properties": {
            "operation": {
              "type": "string"
            },
            "operationName": {
              "type": "string"
            },
            "fields": {
              "minItems": 1,
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": ["operation", "fields"]
        }
      }
    },
    "operations": {
      "type": "array",
      "items": {
        "title": "RequestOperation",
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "timestamp": {
            "type": "integer"
          },
          "operationMapKey": {
            "type": "string"
          },
          "execution": {
            "title": "Execution",
            "additionalProperties": false,
            "type": "object",
            "properties": {
              "ok": {
                "type": "boolean"
              },
              "duration": {
                "type": "integer"
              },
              "errorsTotal": {
                "type": "integer"
              }
            },
            "required": ["ok", "duration", "errorsTotal"]
          },
          "metadata": {
            "title": "Metadata",
            "additionalProperties": false,
            "type": "object",
            "properties": {
              "client": {
                "title": "Client",
                "additionalProperties": false,
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "version": {
                    "type": "string"
                  }
                },
                "required": ["name", "version"]
              }
            }
          },
          "persistedDocumentHash": {
            "type": "string",
            "title": "PersistedDocumentHash",
            "pattern": "^[a-zA-Z0-9_-]{1,64}~[a-zA-Z0-9._-]{1,64}~([A-Za-z]|[0-9]|_){1,128}$"
          }
        },
        "required": ["timestamp", "operationMapKey", "execution"]
      }
    },
    "subscriptionOperations": {
      "type": "array",
      "items": {
        "title": "SubscriptionOperation",
        "additionalProperties": false,
        "type": "object",
        "properties": {
          "timestamp": {
            "type": "integer"
          },
          "operationMapKey": {
            "type": "string"
          },
          "metadata": {
            "title": "Metadata",
            "additionalProperties": false,
            "type": "object",
            "properties": {
              "client": {
                "title": "Client",
                "additionalProperties": false,
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "version": {
                    "type": "string"
                  }
                },
                "required": ["name", "version"]
              }
            }
          }
        },
        "required": ["timestamp", "operationMapKey"]
      }
    }
  },
  "required": ["size", "map"]
}
```

</details>

## Raw JSON Example Payload

```json
{
  "size": 3,
  "map": {
    "c3b6d9b0": {
      "operationName": "me",
      "operation": "query me { me { id name } }",
      "fields": ["Query", "Query.me", "User", "User.id", "User.name"]
    },
    "762a45e3": {
      "operationName": "users",
      "operation": "query users { users { id } }",
      "fields": ["Query", "Query.users", "User", "User.id"]
    },
    "12f3712a": {
      "operationName": "liveCoordinates",
      "operation": "subscription liveCoordinates { location { x y } }",
      "fields": [
        "Subscription",
        "Subscription.location",
        "User",
        "Location",
        "Location.x",
        "Location.y"
      ]
    }
  },
  "operations": [
    {
      "operationMapKey": "c3b6d9b0", // points to the 'me' query
      "timestamp": 1663158676535, // must be within retention period of use plan (free/Pro/enterprise)
      "execution": {
        "ok": true,
        "duration": 150000000, // 150ms in nanoseconds
        "errorsTotal": 0
      },
      "metadata": {
        "client": {
          "name": "demo",
          "version": "0.0.1"
        }
      }
    },
    {
      "operationMapKey": "c3b6d9b0", // points to the 'me' query
      "timestamp": 1663158676589,
      "execution": {
        "ok": false, // failed operation
        "duration": 150000000, // 150ms in nanoseconds
        "errorsTotal": 1 // 1 GraphQL error
      },
      "metadata": {
        "client": {
          "name": "demo",
          "version": "0.0.1"
        }
      }
    },
    {
      "operationMapKey": "762a45e3", // points to the 'users' query
      "timestamp": 1663158676589,
      "execution": {
        "ok": true,
        "duration": 150000000, // 150ms in nanoseconds
        "errorsTotal": 0
      },
      "metadata": {
        "client": {
          "name": "demo",
          "version": "0.0.1"
        }
      }
    }
  ],
  "subscriptionOperations": [
    {
      "operationMapKey": "12f3712a", // points to the 'users' query
      "timestamp": 1663158676589,
      "metadata": {
        "client": {
          "name": "demo",
          "version": "0.0.1"
        }
      }
    }
  ]
}
```

## Curl example request

```bash
curl -X POST \
  https://app.graphql-hive.com/usage \
  -H 'Authorization: Bearer token-here' \
  -H 'X-Usage-API-Version: 2' \
  -H 'content-type: application/json' \
  -d '{ "size": 1, "map": { "aaa": { "operationName": "me", "operation": "query me { me { id } }", "fields": ["Query", "Query.me", "User", "User.id"] } }, "operations": [{ "operationMapKey" : "c3b6d9b0", "timestamp" : 1663158676535, "execution" : { "ok" : true, "duration" : 150000000, "errorsTotal" : 0 }, "metadata" : { "client" : { "name" : "demo" , "version" : "0.0.1" } } } ] }'
```
