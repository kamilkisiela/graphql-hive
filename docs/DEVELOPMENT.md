# Development

## Prerequisites

Developing Hive locally requires you to have the following software installed locally:

- Node.js (or `nvm` or `fnm`): check the `package.json` `engines` entry for the correct version
- pnpm: check the `package.json` `engines` entry for the correct version
- Docker version 26.1.1 or later(previous versions will not work correctly on arm64)
- make sure these ports are free: 5432, 6379, 9000, 9001, 8123, 9092, 8081, 8082, 9644, 3567, 7043,
  10255 (OTEL collector `/metrics`)
- If using the optional observability profile (see below), additionally: 3030 (Grafana), 9090
  (Prometheus)

## Setup Instructions

- Clone the repository locally
- Make sure to install the recommended VSCode extensions (defined in `.vscode/extensions.json`)
- In the root of the repo, run `nvm use` (or `fnm use`) to use the required Node.js version
- Create `.env` file in the root, and use the following:

```dotenv
ENVIRONMENT=local
```

- Run `pnpm i` at the root to install all the dependencies and run the hooks. This also runs
  `pnpm env:sync` automatically (part of `postinstall`), which copies each package's `.env.template`
  to `.env` on first install, and on subsequent installs adds any newly-introduced keys to existing
  `.env` files **without overwriting values you've customized**. So when pulling a branch that adds
  env vars, `pnpm install` is usually all you need — no manual copying. Run `pnpm env:sync --force`
  to force-regenerate from templates if you need to (overwrites local customizations).
- Run `pnpm local:setup` to run Docker compose dependencies, create databases and migrate database.
  This passes `--build` so any custom-built image (currently just `otel-collector`) is reconciled
  with its source on every run. BuildKit caching makes it near-instant when nothing changed.

Solving permission problems on this step:

```bash
export UID=$(id -u)
export GID=$(id -g)
```

Add "user" field to ./docker/docker-compose.dev.yml

```
  clickhouse:
    user: '${UID}:${GID}'
  db:
    user: '${UID}:${GID}'
```

- Run `pnpm generate` to generate the typings from the graphql files (use `pnpm graphql:generate` if
  you only need to run GraphQL Codegen)
- Run `pnpm build` to build all services
  - This also builds `laboratory`, which console consumes from `dist` as any other consumer would.
- Click on `Start Hive` in the bottom bar of VSCode (alternatively you can manually start the
  services you need)
- Open the UI (`http://localhost:3000` by default) and Sign in with any of the identity provider
- Once this is done, you should be able to log in and use the project

## Development Seed

We have a script to feed your local instance of Hive with initial seed data. This step is optional.

1. Use `Start Hive` to run your local Hive instance
2. Make sure `usage` and `usage-ingestor` are running as well (with `pnpm dev`)
3. (Optional) Seed a organization with many projects and users `pnpm seed:org`
4. Open Hive app, create a project and a target, then create a token (or use the previously created
   one)
5. Run the seed script: `FEDERATION=<0|1> TOKEN=<access_token> TARGET=<target_id> pnpm seed:schemas`
6. This should report a dummy schema
7. Run the usage seed to generate some dummy usage data to your local instance of Hive, allowing you
   to test features e2e: `FEDERATION=<0|1> TOKEN=<access_token> TARGET=<target_id> pnpm seed:usage`

> Note: You can set `STAGE=<dev|staging|local>` in order to target a specific Hive environment and
> seed a target there. `TARGET=<target_id>` can be obtained via target's Settings page → General →
> Resource ID. `TOKEN=<access_token>` is created on organization's Setting's page → Access Tokens

> To send more operations with `seed:usage`, and test heavy load on Hive instance, you can also set
> `OPERATIONS` (amount of operations in each interval round, default is `10`) and `INTERVAL`
> (frequency of sending operations, default: `1000`ms). For example, using
> `INTERVAL=1000 OPERATIONS=1000` will send 1000 requests per second. And set `BATCHES` to set the
> total number of batches to run before the seed exits. Default: 10.

### Troubleshooting

We recommend the following flow if you are having issues with running Hive locally:

1. Stop all Docker containers: `docker kill $(docker ps -q)`
2. Clear all local Docker environment: `docker system prune --all --force --volumes`
3. Delete all generated local `.env` files: `find . -name '.env' | xargs rm`
4. Delete local `docker/.hive` and `docker/.hive-dev` dir used by Docker volumes.
5. Reinstall dependencies using `pnpm install`
6. Force-generate new `.env` files: `pnpm env:sync --force`

## Local Grafana + Prometheus (optional)

The dev stack includes an opt-in `observability` profile that runs Grafana and Prometheus locally
with the production dashboards. It's useful when working on metrics, alerts, or anything that relies
on visualizing what services emit. The default `pnpm local:setup` and the VSCode `Start Hive` button
do not start it.

The observability profile runs **alongside** the default stack, not instead of it. Start the default
stack first (either way works), then add the observability profile on top.

If you already started Hive via `pnpm local:setup` or the VSCode `Start Hive` button:

```bash
pnpm dev:observability
```

(equivalent to `docker compose -f docker/docker-compose.dev.yml --profile observability up -d`).
Tear it down again with `pnpm dev:observability:down`.

If you're starting from scratch and want both at once:

```bash
docker compose -f docker/docker-compose.dev.yml --profile observability up -d --remove-orphans
```

Either command is idempotent and safe to re-run.

- Grafana: <http://localhost:3030> (anonymous admin enabled, local only). All dashboards from
  `deployment/grafana-dashboards/` appear under the "Hive Monitoring (local)" folder.
- Prometheus: <http://localhost:9090>, scrape targets at <http://localhost:9090/targets>.
- Tempo: <http://localhost:3200>. Used by the Metric-Alerts dashboard's trace panels for the
  workflows service's alert-evaluator and notification-dispatch spans. See
  `scripts/seed-alerts-live/README.md` for a script that drives load through this path.

> **Dual-collector model.** Production splits OTLP ingest across two collectors: one customer-facing
> with `hiveauth` (deployed via
> [`deployment/services/otel-collector.ts`](../deployment/services/otel-collector.ts)) for customer
> trace ingest on `:4318`/`:4317`, and a separate auth-free internal collector (deployed via the
> Helm chart in [`deployment/utils/observability.ts`](../deployment/utils/observability.ts)) for
> Hive services' own spans. Internal services (`server`, `workflows`, `commerce`, etc.) point at the
> **internal** collector via `OPENTELEMETRY_COLLECTOR_ENDPOINT`. Locally we collapse both roles into
> the single `otel-collector` container by adding a second auth-free receiver block
> (`otlp/internal`, ports `:4319` / `:4320`) alongside the customer-facing one. Hive services
> running on the host point at `http://localhost:4320` (set in each service's `.env.template`);
> customer-style ingest tests still hit `:4318` and exercise `hiveauth`.

- Datasource UIDs locally: `local-prom` and `local-tempo` (clearly distinct from the prod UIDs
  `grafanacloud-prom` / `grafanacloud-traces` so there's no ambiguity about which environment you're
  looking at).

### How dashboards get to local Grafana

A small `grafana-dashboard-init` container copies the JSON files from
`deployment/grafana-dashboards/` into `docker/.hive-dev/grafana/dashboards/` at startup, performing
the same parameter substitution Pulumi does (`PROM_DATASOURCE_UID` becomes `local-prom`,
`TEMPO_DATASOURCE_UID` becomes `local-tempo`, `TABLE_SUFFIX` becomes `dev`). Grafana picks them up
via file-based provisioning. The source JSONs stay the single source of truth.

### Scraping host-running services

Prometheus is configured to scrape `host.docker.internal:10254`, which is where Hive services expose
`/metrics` by default (their `PROMETHEUS_METRICS_PORT` env var defaults to `10254`). The compose
file sets `extra_hosts: host.docker.internal:host-gateway` on the prometheus service so this
resolves on Linux too (Docker Desktop on macOS/Windows provides it automatically).

The OTEL collector container internally listens on `10254` as well, but
[docker/docker-compose.dev.yml](../docker/docker-compose.dev.yml) publishes that container port on
host port **10255**, not 10254, so the host's port 10254 stays free for any Hive service a developer
runs natively (via `pnpm dev` or the VSCode `Start Hive` button). Prometheus reaches the OTEL
collector via docker DNS (`otel-collector:10254`), which is unaffected by the host mapping choice.

If you run more than one Hive service natively at the same time, only the first can use port 10254.
For the others, set `PROMETHEUS_METRICS_PORT` to a different free port and add it as an extra target
in [docker/configs/prometheus/prometheus.yml](../docker/configs/prometheus/prometheus.yml).

### Linux: filesystem permissions on `.hive-dev/grafana/data`

Grafana inside the container runs as UID 472. On Linux bind mounts that can produce
permission-denied errors when Grafana tries to write to `docker/.hive-dev/grafana/data`. The same
UID/GID workaround documented above for `clickhouse`/`db` applies: add `user: '${UID}:${GID}'` to
the `grafana` service entry in `docker/docker-compose.dev.yml` (and ensure those env vars are
exported in your shell). macOS does not need this.

## Zendesk mock (optional)

The dev stack includes an opt-in `zendesk` profile that runs a MockServer instance to mimic the
Zendesk API. This is configured in
[docker/configs/zendesk-mock/expectations.json](../docker/configs/zendesk-mock/expectations.json).

Use this to test the support-ticket flow locally without a real Zendesk account.

1. Set these variables in `packages/services/server/.env` (restart the server afterwards so it picks
   them up):

   ```
   ZENDESK_SUPPORT=1
   ZENDESK_USERNAME=mock
   ZENDESK_PASSWORD=mock
   ZENDESK_BASE_URL=http://localhost:3043/local
   ```

   The `/local` path suffix is optional; the mock matches any path ending in `/api/v2/...`.

2. Start the mock. It uses a separate command since it's not frequently needed:

   ```bash
   pnpm dev:zendesk-mock
   ```

   Tear it down with `pnpm dev:zendesk-mock:down`.

After submitting a ticket, confirm the request reached the mock by querying its recorded requests:

```bash
curl -s -X PUT 'http://localhost:3043/mockserver/retrieve?type=REQUESTS' | jq
```

## Publish your first schema (manually)

1. Start Hive locally
2. Create a project and a target
3. Create a token from that target
4. Go to `packages/libraries/cli` and run `pnpm build`
5. Inside `packages/libraries/cli`, run:

   ```sh
   pnpm start schema:publish --registry.accessToken "YOUR_TOKEN_HERE" --registry.endpoint "http://localhost:3001/graphql" examples/single.graphql
   ```

   The registry endpoint is the GraphQL endpoint of your local `server` service. You can also edit
   the `hive.json` file in the `cli` package to avoid passing the `accessToken` and `endpoint` every
   time.

### Setting up Slack App for developing

1. [Download](https://loophole.cloud/download) Loophole CLI (same as ngrok but supports non-random
   urls)
2. Log in to Loophole `$ loophole account login`
3. Start the proxy by running `$ loophole http 3000 --hostname hive-<your-name>` (@kamilkisiela I
   use `hive-kamil`). It creates `https://hive-<your-name>.loophole.site` endpoint.
4. Message @kamilkisiela and send him the url (He will update the list of accepted redirect urls in
   Slack App).
5. Update `APP_BASE_URL` in [`packages/web/app/.env`](./packages/web/app/.env) to the proxy URL
   (e.g. `https://hive-<your-name>.loophole.site`)
6. Run `packages/web/app` and open `https://hive-<your-name>.loophole.site`.

> We have a special Slack channel called `#hive-tests` to not spam people :)

### Setting up GitHub App for developing

#### Starting a proxy for GitHub App

1. Follow first two steps from `Setting up Slack App for developing` (download loophole and log in).
2. Start web app proxy: `$ loophole http 3000 --hostname hive-<your-name>`
3. Start server proxy: `$ loophole http 3001 --hostname hive-<your-name>`

#### Creating a GitHub App

1. Go to `Settings` -> `Developer settings` -> `GitHub Apps`, and click on the `New GitHub App`
   button.
2. Provide a name for your app, and set the `Homepage URL` to
   `https://hive-<your-name>.loophole.site`. Then set the callback URL to
   `https://hive-<your-name>.loophole.site/api/github/callback`, and post installation's callback
   URL to `https://hive-<your-name>.loophole.site/api/github/setup-callback`.
3. Click on `Create GitHub App`.

#### Setting up env variables

1. Server: Set the following env variables in `packages/services/server/.env`:

   ```dotenv
   INTEGRATION_GITHUB=1
   INTEGRATION_GITHUB_GITHUB_APP_ID=<your-github-app-id>
   ```

   You'll find the GitHub App ID and private key in the `General` tab of your GitHub App.

   Store the Github private key next to the `.env` file with the name `github-app.pem`
   (`packages/services/server/github-app.pem`)

2. Web App: Set the following in `packages/web/app/.env`:
   ```dotenv
   INTEGRATION_GITHUB_APP_NAME=<your-github-app-name>
   ```

#### Installing the GitHub App

Open Hive UI and go to your organization's settings page. Find `Integrations` section and click on
`Connect GitHub`. You should be redirected to GitHub where you can grant repository access. After
installing the app, you should be redirected back to Hive.

#### Testing

1. Create a project and a target.
2. Create a token from that target.
3. Setup a GitHub repo with CI/CD actions like this one:
   https://github.com/n1ru4l/hive-federation-subgraph/.
4. Add the token to the repo's secrets as `HIVE_TOKEN`.
5. If self hosting, add Hive endpoint to the repo's secrets as `HIVE_REGISTRY`
   (`https://hive-<your-name>.loophole.site/graphql`).
6. Make sure your GitHub app is installed on that repo.
7. Push a commit to the repo and check if the CI/CD action is triggered.

### Local OIDC Testing

The `docker-compose.dev.yml` files includes a mock OIDC server that can be used for testing the OIDC
login/logout flow locally. The server tuns on port `7043`.

Please make sure to set the `AUTH_ORGANIZATION_OIDC` environment variables for the `server` and
`app` to `"1"`.

You can use the following values for connecting an integration to an OIDC provider.

```
# Token Endpoint
http://localhost:7043/connect/token
# User Info Endpoint
http://localhost:7043/connect/userinfo
# Authorization Endpoint
http://localhost:7043/connect/authorize
# Client ID
implicit-mock-client
# Client Secret
client-credentials-mock-client-secret
```

For login use the following credentials.

```
# Username
test-user
# Password
password
```

### Run Hive

1. Click on Start Hive in the bottom bar of VSCode
2. Open the UI (`http://localhost:3000` by default) and register any email and password
3. Sending e-mails is mocked out during local development, so in order to verify the account find
   the verification link by visiting the workflow server's `/_history` endpoint -
   `http://localhost:3014/_history` by default.
   - Searching for `token` should help you find the link.
