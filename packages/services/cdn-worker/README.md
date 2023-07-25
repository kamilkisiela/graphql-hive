## Hive CDN Worker

Hive comes with a CDN worker (deployed to CF Workers), along with KV cache to storage.

### Standalone Development

To run Hive CDN locally, you can use the following command: `pnpm dev`.

> Note: during dev, KV is mocked using JS `Map`, so it's ephemeral and will be deleted with any
> change in code.

To publish manually a schema, for target id `1`:

```sh
curl -X PUT http://localhost:4010/1/storage/kv/namespaces/2/values/target:1:schema --data-raw '{"sdl": "type Query { foo: String }" }' -H 'content-type: text/plain'
```

You can also use the following to dump everything stored in the mocked KV:

```sh
curl http://localhost:4010/dump
```

To fetch a specific resource, for target id `1`, run one of the following:

```sh
curl http://localhost:4010/1/schema -H "x-hive-cdn-key: fake"
curl http://localhost:4010/1/sdl -H "x-hive-cdn-key: fake"
curl http://localhost:4010/1/introspection -H "x-hive-cdn-key: fake"
```

> Hive CDN Auth and access management is not enforced AT ALL during development.

### Local Development with Hive Server

Hive server has `CF_BASE_PATH` env var that tells is where to send the published schemas.

To connect your server to the local, mocked CDN, make sure you have the following in
`packages/server/.env`:

```dotenv
CF_BASE_PATH=http://localhost:4010
```

This way, your local Hive instance will be able to send schema to the locally running CDN Worker.
