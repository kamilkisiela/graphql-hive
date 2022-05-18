## Hive Police Worker

1. Hive code, or Hive support teams can now create and maintain a list of rules that needs to be blocked on CF.
2. List of rules is defined in CloudFlare KV (as the `K`).
3. A CF Worker is running every X minutes (defined in Pulumi code), and syncs the records in KV into a CloudFlare WAF Rule.
4. When synced correctly, CF will make sure to block all matching requests and prevent traffic from getting to Hive servers.

> You can also trigger the scheduled worker manually from CloudFlare dashboard if you need to speed things up.

## Available Rules

- Block missing/empty header: `header:HEADER_NAME:empty`
- Block by header value: `header:HEADER_NAME:SOME_VALUE` (or, with method: `header:HEADER_NAME:SOME_VALUE:POST`, or with method and path: `header:HEADER_NAME:SOME_VALUE:POST:/usage`)
- Block by IP: `ip:123.123.123.123`

### Useful Links

- CloudFlare List of KVs: https://dash.cloudflare.com/6d5bc18cd8d13babe7ed321adba3d8ae/workers/kv/namespaces (we use `hive-police-ENV`)
- CF Expressions documentation: https://developers.cloudflare.com/ruleset-engine/rules-language/
