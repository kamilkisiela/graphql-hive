# Usage Reporting

The official JavaScript Hive Client (`@graphql-hive/client`) collects executed operations and sends
them in batches (as a single report, when a buffer is full or every few seconds) over HTTP.

> It's recommended to send a report for more than 1 operation. The maximum payload size is 1 MB.

| Name     | Value                                |
| -------- | ------------------------------------ |
| Endpoint | `https://app.graphql-hive.com/usage` |
| Header   | `Authorization: Bearer token-here`   |
| Method   | `POST`                               |

## Data structure

<details>
  <summary>TypeScript schema</summary>

```typescript
export interface Report {
  /**
   * Number of collected operations
   */
  size: number
  map: {
    [k: string]: OperationMapRecord
  }
  /** request executions (mutation and query) */
  operations: RequestOperation[]
  /** subscription executions */
  subscriptionOperations: SubscriptionOperation[]
}

export interface OperationMapRecord {
  /**
   * Operation's body
   * e.g. query me { me { id name } }
   */
  operation: string
  /**
   * Name of the operation ('me')
   */
  operationName?: string
  /**
   * @minItems 1
   * Schema coordinates (['Query', 'Query.me', 'User', 'User.id', 'User.name'])
   */
  fields: [string, ...string[]]
}

export interface RequestOperation {
  /**
   * The key of the operation in the operation map
   */
  operationMapKey: string
  /**
   * A number representing the milliseconds elapsed since the UNIX epoch.
   */
  timestamp: number
  execution: Execution
  metadata?: Metadata
}

export interface Execution {
  /**
   * true - successful operation
   * false - failed operation
   */
  ok: boolean
  /**
   * Duration of the entire operation in nanoseconds
   */
  duration: number
  /**
   * Total number of GraphQL errors
   */
  errorsTotal: number
}

export interface Metadata {
  client?: Client
}

export interface Client {
  name?: string
  version?: string
}

export interface SubscriptionOperation {
  /**
   * A number representing the milliseconds elapsed since the UNIX epoch.
   */
  timestamp: number
  /**
   * The key of the operation in the operation map
   */
  operationMapKey: string
  metadata?: Metadata
}
```

</details>

<details>
  <summary>JSON Schema</summary>

```json
{
  "$ref": "#/definitions/Report",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Client": {
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string"
        },
        "version": {
          "type": "string"
        }
      },
      "type": "object"
    },
    "Execution": {
      "additionalProperties": false,
      "properties": {
        "duration": {
          "description": "Duration of the entire operation in nanoseconds",
          "type": "number"
        },
        "errorsTotal": {
          "description": "Total number of GraphQL errors",
          "type": "number"
        },
        "ok": {
          "description": "true - successful operation false - failed operation",
          "type": "boolean"
        }
      },
      "required": ["ok", "duration", "errorsTotal"],
      "type": "object"
    },
    "Metadata": {
      "additionalProperties": false,
      "properties": {
        "client": {
          "$ref": "#/definitions/Client"
        }
      },
      "type": "object"
    },
    "Operation": {
      "additionalProperties": false,
      "properties": {
        "execution": {
          "$ref": "#/definitions/Execution"
        },
        "metadata": {
          "$ref": "#/definitions/Metadata"
        },
        "operationMapKey": {
          "description": "The key of the operation in the operation map",
          "type": "string"
        },
        "timestamp": {
          "description": "A number representing the milliseconds elapsed since the UNIX epoch.",
          "type": "number"
        }
      },
      "required": ["operationMapKey", "timestamp", "execution"],
      "type": "object"
    },
    "SubscriptionOperation": {
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "timestamp": {
          "description": "A number representing the milliseconds elapsed since the UNIX epoch.",
          "type": "number"
        },
        "operationMapKey": {
          "type": "string"
        },
        "metadata": {
          "$ref": "#/definitions/Metadata"
        }
      }
    },
    "OperationMap": {
      "additionalProperties": {
        "$ref": "#/definitions/OperationMapRecord"
      },
      "type": "object"
    },
    "OperationMapRecord": {
      "additionalProperties": false,
      "properties": {
        "fields": {
          "description": "Schema coordinates (['Query', 'Query.me', 'User', 'User.id', 'User.name'])",
          "items": {
            "type": "string"
          },
          "type": "array"
        },
        "operation": {
          "description": "Operation's body e.g. query me { me { id name } }",
          "type": "string"
        },
        "operationName": {
          "description": "Name of the operation ('me')",
          "type": "string"
        }
      },
      "required": ["operation", "fields"],
      "type": "object"
    },
    "Report": {
      "additionalProperties": false,
      "properties": {
        "map": {
          "$ref": "#/definitions/OperationMap"
        },
        "operations": {
          "items": {
            "$ref": "#/definitions/Operation"
          },
          "type": "array"
        },
        "subscriptionOperations": {
          "items": {
            "$ref": "#/definitions/SubscriptionOperation"
          },
          "type": "array"
        },
        "size": {
          "description": "Number of collected operations",
          "type": "number"
        }
      },
      "required": ["size", "map"],
      "type": "object"
    }
  }
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
  -H 'content-type: application/json' \
  -d '{ "size": 1, "map": { "aaa": { "operationName": "me", "operation": "query me { me { id } }", "fields": ["Query", "Query.me", "User", "User.id"] } }, "operations": [{ "operationMapKey" : "c3b6d9b0", "timestamp" : 1663158676535, "execution" : { "ok" : true, "duration" : 150000000, "errorsTotal" : 0 }, "metadata" : { "client" : { "name" : "demo" , "version" : "0.0.1" } } } ] }'
```
