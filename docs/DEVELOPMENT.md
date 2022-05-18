# Development

## Setup Instructions

- Clone the repository locally
- Make sure to install the recommended VSCode extensions (defined in `.vscode/extensions.json`)
- In the root of the repo, run `nvm use` to use the same version of node as mentioned
- Run `yarn` at the root to install all the dependencies and run the hooks

- Run `yarn setup` to create and apply migrations on the PostgreSQL database
- Run `yarn generate` to generate the typings from the graphql files (use `yarn graphql:generate` if you only need to run GraphQL Codegen)
- Run `yarn build` to build all services
- Click on `Start Hive` in the bottom bar of VSCode
- Open the UI (`http://localhost:3000` by default) and Sign in with any of the identity provider
- If you are not added to the list of guest users, request access from The Guild maintainers
- Once this is done, you should be able to login and use the project
- Once you generate the token against your organization/personal account in hive, the same can be added locally to `hive.json` within `packages/libraries/cli` which can be used to interact via the hive cli with the registry

## Development Seed

We have a script to feed your local instance of Hive.

1. Use `Start Hive` to run your local Hive instance
2. Make sure `usage` and `usage-ingestor` are running as well (with `yarn dev`)
3. Open Hive app, create a project and a target, then create a token
4. Run the seed script: `TOKEN="MY_TOKEN_HERE" yarn seed`
5. This should report a dummy schema and some dummy usage data to your local instance of Hive, allowing you to test features e2e

> Note: You can set `STAGING=1` in order to target staging env and seed a target there.

> To send more operations and test heavy load on Hive instance, you can also set `OPERATIONS` (amount of operations in each interval round, default is `1`) and `INTERVAL` (frequency of sending operations, default: `1000`ms). For example, using `INTERVAL=1000 OPERATIONS=1000` will send 1000 requests per second.

## Publish your first schema (manually)

1. Start Hive locally
1. Create a project and a target
1. Create a token from that target
1. Go to `packages/libraries/cli` and run `yarn build`
1. Inside `packages/libraries/cli`, run: `yarn start schema:publish --token "YOUR_TOKEN_HERE" --registry "http://localhost:4000/graphql" examples/single.graphql`

### Setting up Slack App for developing

1. [Download](https://loophole.cloud/download) Loophole CLI (same as ngrok but supports non-random urls)
2. Log in to Loophole `$ loophole account login`
3. Start the proxy by running `$ loophole http 3000 --hostname hive-<your-name>` (@kamilkisiela I use `hive-kamil`). It creates `https://hive-<your-name>.loophole.site` endpoint.
4. Message @kamilkisiela and send him the url (He will update the list of accepted redirect urls in both Auth0 and Slack App).
5. Update `APP_BASE_URL` and `AUTH0_BASE_URL` in [`packages/web/app/.env`](./packages/web/app/.env)
6. Run `packages/web/app` and open `https://hive-<your-name>.loophole.site`.

> We have a special Slack channel called `#hive-tests` to not spam people :)

### Setting up GitHub App for developing

1. Follow the steps above for Slack App
2. Update `Setup URL` in [GraphQL Hive Development](https://github.com/organizations/the-guild-org/settings/apps/graphql-hive-development) app and set it to `https://hive-<your-name>.loophole.site/api/github/setup-callback`
