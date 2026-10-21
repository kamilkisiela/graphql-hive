---
'hive': patch
---

Schema publish now returns a `SchemaPublishError` instead of a generic error when the request has no schema source or both `sdl` and `schema`, when the SDL cannot be parsed, or when the metadata is not valid JSON.
