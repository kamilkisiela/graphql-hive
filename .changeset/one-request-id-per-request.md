---
'hive': patch
---

Use one request id per API request. The id is the incoming `x-request-id` header, or a generated UUID when none was sent, and it is now the same value on the API's own log lines, the `request.id` trace attribute, the `x-request-id` response header, and the request forwarded to the schema service. Schema-service logs and traces can therefore be correlated with the API request that triggered them even when no proxy supplied an id. Every response from a Hive service now carries that id in the `x-request-id` header, including error responses produced before a request handler runs. Background proposal compositions run by the workflows service now carry the id of the API request that scheduled them.
