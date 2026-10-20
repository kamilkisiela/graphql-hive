---
'@graphql-hive/core': patch
'@graphql-hive/cli': patch
---

Surface the registry's request id on HTTP errors. `HTTPResponseError` thrown by the core HTTP client now carries the `x-request-id` the server returned, and the CLI prints it as `Request ID` on HTTP error responses (for example a request rejected because its body is too large), the same way it already does for GraphQL errors. Previously only the client-generated id was visible, which does not match anything on the server.
