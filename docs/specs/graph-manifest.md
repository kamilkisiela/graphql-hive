# Graph Manifest

The Graph Manifest describes the set of GraphQL supergraphs or monolithic schemas that Hive Console
manages and that should be served via a Hive Router/Gateway (in the following sections referred to
as router for simplicity) instance.

It is configuration file for a running router instance that is being polled continiously from the
Hive CDN. Hive Console publishes the desired state, while routers periodically retrieve the manifest
and adjust their currently running graphs based on that.

> The manifest is intentionally kept generic so that additional runtime configuration can be
> introduced in the future without requiring separate configuration endpoints. Examples of future
> configuration could include caching configuration, logging configuration, runtime feature flags,
> or other router settings.

## Manifest Endpoint

Each target exposes its manifest through the Hive CDN:

```
https://cdn.graphql-hive.com/<target-id>/manifest.json
https://cdn-mirror.graphql-hive.com/<target-id>/manifest.json
```

Routers periodically poll this endpoint.

## Manifest Format

```json
{
  "graphs": {
    "default": {
      "id": "<uuid>",
      "currentVersion": {
        "id": "781cf01b-305d-4890-a78b-1be204b42ee5",
        "artifactPath": "/my-target/versions/781cf01b-305d-4890-a78b-1be204b42ee5",
        "revision": "2026-09-16-production"
      }
    },
    "default/contract-a": {
      "id": "<uuid>",
      "currentVersion": {
        "id": "344d8d0c-d414-4727-a7d8-8cee2dc11182",
        "artifactPath": "/my-target/versions/344d8d0c-d414-4727-a7d8-8cee2dc11182",
        "revision": "2026-09-16-contract-a"
      }
    },
    "graph-b": {
      "id": "<uuid>",
      "currentVersion": {
        "id": "89780103-7ea3-490f-99ba-c60e90eed41b",
        "artifactPath": "/my-target/versions/89780103-7ea3-490f-99ba-c60e90eed41b"
      }
    }
  }
}
```

### `graphs`

graphs contains the complete set of graphs that should currently be served for the target. The
object key is the **graph name**.

Graph names are semantic identifiers. They are stable from the router's point of view and allow
multiple independently addressable graphs to exist within a single Hive target. Examples include:

```
default
default/contract-a
graph-b
feature-flag-a
```

The exact meaning of a graph name is determined by Hive Console. Routers should treat graph names as
opaque identifiers. In particular, consumers should not infer special behavior from names such as
`default/contract-a`.

The router could use these names in order to route traffic based on a header or cookie.

### `id`

An id that uniquely identifies a graph.

Routers can expose it through logs, metrics or traces. For example:

```
graph.name=default
graph.id=781cf01b-305d-4890-a78b-1be204b42ee5
```

This SHOULD be reported as part of usage reporting to correlate usage data with a specific graph.

### `currentVersion`

`currentVersion` is required and describes the immutable schema version currently assigned to a
graph.

#### `id`

`currentVersion.id` is required and identifies the immutable Hive schema version backing the graph.
A changed `currentVersion.id` does not automatically mean that `currentVersion.artifactPath`
changed.

Routers can expose it through logs, metrics or traces. For example:

```
graph.name=default
graph.version.id=781cf01b-305d-4890-a78b-1be204b42ee5
```

This SHOULD be reported as part of usage reporting to correlate usage data with a specific graph
version.

#### `artifactPath`

`currentVersion.artifactPath` is required and is used to fetch the schema artifacts needed in order
to serve the graph.

The full artifact path can be constructed like the following:

```js
concat(
  // "https://cdn.graphql-hive.com" or "https://cdn-mirror.graphql-hive.com"
  // depending on config
  mirrorBase,
  // the path as read from the manifest
  artifactPath,
  // the actual artifact that needs to be retrieved
  // "/supergraph" for federation projects
  '/supergraph'
)
```

If `currentVersion.artifactPath` changed, the new schema SDL can be retrieved via this endpoint and
afterwards served clients.

#### `revision`

```json
{
  "currentVersion": {
    "revision": "2026-09-16-production"
  }
}
```

`currentVersion.revision` is an optional immutable identifier supplied by the user or deployment
process.

It exists primarily to associate the running graph with a user-facing release or deployment
identifier.

Similar to `currentVersion.id`, routers can expose it through logs, metrics or traces. For example:

```
graph.name=default
graph.revision=2026-09-16-production
```

## Reconciliation

The manifest represents the **complete desired state** of the target (environment).

A router should periodically fetch the manifest and compare it with the previously successfully
applied manifest.

For every graph, one of the following situations can occur.

### Graph version changed

Previous manifest:

```json
"graphs": {
  "default": {
    "currentVersion": {
      "id": "version-a",
      "artifactPath": "/my-target/versions/version-a",
      "revision": "revision-a"
    }
  }
}
```

New Manifest:

```json
{
  "graphs": {
    "default": {
      "currentVersion": {
        "id": "version-b",
        "artifactPath": "/my-target/versions/version-b",
        "revision": "revision-b"
      }
    }
  }
}
```

The router should:

1. Fetch the new supergraph SDL.
2. Validate and initialize the new graph runtime.
3. Replace the currently served version once the new version is ready.

The existing graph should remain available until the new version has been successfully initialized.

**Note:** A changed `currentVersion.id` and `currentVersion.revision` does not necessarily mean that
`currentVersion.artifactPath` has changed. Thus an HTTP roundtrip can be saved if
`currentVersion.artifactPath` stayed the same.

### Graph Added

Previous manifest:

```json
{
  "graphs": {}
}
```

New Manifest:

```json
{
  "graphs": {
    "graph-b": {
      "currentVersion": {
        "id": "version-b",
        "artifactPath": "/my-target/versions/version-b",
        "revision": "revision-b"
      }
    }
  }
}
```

The router should fetch the referenced supergraph SDL and begin serving the graph.

### Graph Removed

Previous manifest:

```json
{
  "graphs": {
    "graph-b": {
      "currentVersion": {
        "id": "version-b",
        "artifactPath": "/my-target/versions/version-b",
        "revision": "revision-b"
      }
    }
  }
}
```

```json
{
  "graphs": {}
}
```

The graph is no longer part of the desired state and should be stopped and removed from the router.

### Graph unchanged

If `currentVersion.artifactPath` has not changed, its schema does not need to be fetched again. A
change to metadata such as `currentVersion.id` or `currentVersion.revision` may still be applied to
runtime metadata even when no schema reload is necessary.

## Failure Handling

A newly retrieved manifest should only replace the router's last known state after it has been
successfully parsed and processed. If the manifest cannot be fetched or parsed, the router should
continue serving the last successfully applied configuration. Likewise, failure to fetch or
initialize a newly referenced graph should not require unrelated graphs to be stopped. For example,
given:

```
default     -> successfully updated
graph-b     -> failed to initialize
graph-c     -> unchanged
```

the failure of `graph-b` should not prevent `default` or `graph-c` from continuing to operate.
Implementations may report the manifest as only partially reconciled until all desired graphs have
been successfully applied.

## Polling and caching

Consumers are expected to poll the manifest. The CDN may use standard HTTP caching mechanisms such
as:

```
ETag
If-None-Match
Cache-Control
```

A router should avoid downloading or processing the complete manifest when the CDN indicates that it
has not changed.

Schema artifacts are immutable because they are addressed by `currentVersion.artifactPath` and may
therefore be cached independently.

## Forward Compatability

Consumers should ignore manifest fields they do not understand unless otherwise specified. For
example, a future manifest could contain:

```json
{
  "graphs": {
    "default": {
      "currentVersion": {
        "id": "781cf01b-305d-4890-a78b-1be204b42ee5",
        "artifactPath": "/my-target/versions/781cf01b-305d-4890-a78b-1be204b42ee5",
        "revision": "production-42"
      }
    }
  },
  "runtime": {
    "logging": {
      "level": "debug"
    },
    "cache": {
      "enabled": true
    }
  }
}
```

An older router that only understands `graphs` should continue operating normally. This allows Hive
Console to evolve from publishing schema state into acting as a broader control plane for Hive
Gateway and Hive Router.
