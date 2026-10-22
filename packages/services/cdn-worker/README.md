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

### Deployment

Choose a stable [Hive release](https://github.com/graphql-hive/console/releases) whose GitHub
Release page contains both deployment assets:

- `hive-cdn-cloudflare-worker.zip`
- `hive-cdn-aws-lambda.zip`

#### Cloudflare Worker

Set the stable Hive version to deploy, then download and extract the release archive:

```sh
VERSION="REPLACE_WITH_HIVE_VERSION"
mkdir hive-cdn-cloudflare-worker
cd hive-cdn-cloudflare-worker
curl --fail --location \
  "https://github.com/graphql-hive/console/releases/download/hive%40${VERSION}/hive-cdn-cloudflare-worker.zip" \
  --output hive-cdn-cloudflare-worker.zip
unzip hive-cdn-cloudflare-worker.zip
```

The extracted `index.mjs` is an ES module Worker. Create a `wrangler.toml` next to it. The following
is a minimal configuration; the six Analytics Engine bindings are required. Dataset names may be
changed, but the binding names must remain unchanged.

The current Worker artifact does not read a Workers KV binding. Hive's Pulumi stack still creates a
legacy `HIVE_DATA` namespace for historical reasons; you do not need it for a working deployment.

```toml
name = "hive-cdn"
main = "index.mjs"
compatibility_date = "2026-03-03"
workers_dev = true

[[analytics_engine_datasets]]
binding = "USAGE_ANALYTICS"
dataset = "hive_ha_cdn_usage_production"

[[analytics_engine_datasets]]
binding = "ERROR_ANALYTICS"
dataset = "hive_ha_cdn_error_production"

[[analytics_engine_datasets]]
binding = "KEY_VALIDATION_ANALYTICS"
dataset = "hive_ha_cdn_key_validation_production"

[[analytics_engine_datasets]]
binding = "R2_ANALYTICS"
dataset = "hive_ha_cdn_r2_production"

[[analytics_engine_datasets]]
binding = "S3_ANALYTICS"
dataset = "hive_ha_cdn_s3_production"

[[analytics_engine_datasets]]
binding = "RESPONSE_ANALYTICS"
dataset = "hive_ha_cdn_response_production"
```

Configure the required primary and mirror S3-compatible storage values and Sentry values as Worker
secrets. Wrangler prompts for each value without putting it in `wrangler.toml`.

```sh
for name in \
  S3_ENDPOINT \
  S3_ACCESS_KEY_ID \
  S3_SECRET_ACCESS_KEY \
  S3_BUCKET_NAME \
  S3_MIRROR_ENDPOINT \
  S3_MIRROR_ACCESS_KEY_ID \
  S3_MIRROR_SECRET_ACCESS_KEY \
  S3_MIRROR_BUCKET_NAME \
  SENTRY_DSN \
  SENTRY_ENVIRONMENT \
  SENTRY_RELEASE; do
  npx wrangler secret put "$name"
done
```

`S3_ENDPOINT` and `S3_MIRROR_ENDPOINT` are the providers' S3-compatible endpoint URLs.
`SENTRY_ENVIRONMENT` is an environment name such as `production`, and `SENTRY_RELEASE` should
identify the deployed Hive release.

The following values are optional:

- `S3_SESSION_TOKEN` and `S3_MIRROR_SESSION_TOKEN` are only needed when the corresponding storage
  credentials are temporary. Configure either with `npx wrangler secret put <NAME>`.
- `KV_STORAGE_BASE_URL` overrides the key-validation storage URL. If omitted, the Worker uses
  `https://key-cache.graphql-hive.com`. Configure it with
  `npx wrangler secret put KV_STORAGE_BASE_URL`.

Deploy the Worker and test its health endpoint:

```sh
npx wrangler deploy
WORKER_URL=https://hive-cdn.example.workers.dev
curl --fail "$WORKER_URL/_health"
```

The health request should return `OK`.

#### AWS Lambda

Download the Lambda archive for the stable Hive version. Upload this ZIP directly; do not extract or
repackage it.

```sh
VERSION="REPLACE_WITH_HIVE_VERSION"
curl --fail --location \
  "https://github.com/graphql-hive/console/releases/download/hive%40${VERSION}/hive-cdn-aws-lambda.zip" \
  --output hive-cdn-aws-lambda.zip
```

1. Create a Lambda execution role whose trust policy allows `lambda.amazonaws.com` to assume it, and
   attach the AWS-managed `AWSLambdaBasicExecutionRole` policy for CloudWatch logging. To use IAM
   authentication for S3, also grant the role `s3:GetObject` access to the artifact bucket.
2. Create the function with these settings:
   - Runtime: Node.js 22.x
   - Package type: ZIP
   - Handler: `index.handler`
   - Architecture: arm64
   - Memory: 448 MB
   - Timeout: 10 seconds
3. Upload `hive-cdn-aws-lambda.zip` as the function code.
4. Configure the required storage environment variables:

   - `AWS_S3_ENDPOINT`: the S3-compatible endpoint URL.
   - `AWS_S3_BUCKET_NAME`: the artifact bucket name.
   - To use the Lambda execution role, set `AWS_S3_IAM_AUTH_ENABLED` to `1`. For example:

     ```sh
     AWS_S3_IAM_AUTH_ENABLED=1
     AWS_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
     AWS_S3_BUCKET_NAME=my-artifacts-bucket
     ```

   - To use static credentials, leave `AWS_S3_IAM_AUTH_ENABLED` unset or set it to `0`, then set
     `AWS_S3_ACCESS_KEY_ID` and `AWS_S3_ACCESSS_KEY_SECRET`. The three consecutive `S` characters in
     `ACCESSS` are required by the current runtime contract.

5. Create a Lambda Function URL. The current Hive deployment uses `NONE` authentication and buffered
   invocation. Review the exposure of an unauthenticated URL before using that setting.

The Function URL can be used directly and may also be configured as a CloudFront origin, which is
the recommended topology for the CDN handler. Configuration available only to the Cloudflare Worker,
including mirror storage, Analytics Engine, KV, and Sentry bindings, is not supported by the Lambda
variant.
