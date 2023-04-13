# Development

## Prerequisites

Developing Hive locally requires you to have the following software installed locally:

- Node.js 18 LTS (or `nvm` or `fnm`)
- pnpm v7
- Docker

## Setup Instructions

- Clone the repository locally
- Make sure to install the recommended VSCode extensions (defined in `.vscode/extensions.json`)
- In the root of the repo, run `nvm use` to use the same version of node as mentioned
- Create `.env` file in the root, and use the following:

```dotenv
SERVER_ENDPOINT=http://localhost:3001
ENVIRONMENT=local
```

- Run `pnpm i` at the root to install all the dependencies and run the hooks
- Run `pnpm local:setup` to run Docker compose dependencies, create databases and migrate database
- Run `pnpm generate` to generate the typings from the graphql files (use `pnpm graphql:generate` if
  you only need to run GraphQL Codegen)
- Run `pnpm build` to build all services
- Click on `Start Hive` in the bottom bar of VSCode
- If you are not added to the list of guest users, request access from The Guild maintainers
  - Alternatively,
    [configure hive to use your own Auth0 Application](#setting-up-auth0-app-for-developing)
- Open the UI (`http://localhost:3000` by default) and Sign in with any of the identity provider
- Once this is done, you should be able to login and use the project
- Once you generate the token against your organization/personal account in hive, the same can be
  added locally to `hive.json` within `packages/libraries/cli` which can be used to interact via the
  hive cli with the registry

## Development Seed

We have a script to feed your local instance of Hive.

1. Use `Start Hive` to run your local Hive instance
2. Make sure `usage` and `usage-ingestor` are running as well (with `pnpm dev`)
3. Open Hive app, create a project and a target, then create a token
4. Run the seed script: `TOKEN="MY_TOKEN_HERE" pnpm seed`
5. This should report a dummy schema and some dummy usage data to your local instance of Hive,
   allowing you to test features e2e

> Note: You can set `STAGING=1` in order to target staging env and seed a target there. Same for
> development env, you can use `DEV=1`

> To send more operations and test heavy load on Hive instance, you can also set `OPERATIONS`
> (amount of operations in each interval round, default is `1`) and `INTERVAL` (frequency of sending
> operations, default: `1000`ms). For example, using `INTERVAL=1000 OPERATIONS=1000` will send 1000
> requests per second.

### Troubleshooting

We recommend the following flow if you are having issues with running Hive locally:

1. Stop all Docker containers: `docker kill $(docker ps -q)`
2. Clear all local Docker environment: `docker system prune --all --force --volumes`
3. Delete all generated local `.env` files: `find . -name '.env' | xargs rm`
4. Delete local `docker/.hive` and `docker/.hive-dev` dir used by Docker volumes.
5. Reinstall dependencies using `pnpm install`
6. Force-generate new `.env` files: `pnpm env:sync --force`

## Publish your first schema (manually)

1. Start Hive locally
2. Create a project and a target
3. Create a token from that target
4. Go to `packages/libraries/cli` and run `pnpm build`
5. Inside `packages/libraries/cli`, run:
   `pnpm start schema:publish --token "YOUR_TOKEN_HERE" --registry "http://localhost:4000/graphql" examples/single.graphql`

### Setting up Slack App for developing

1. [Download](https://loophole.cloud/download) Loophole CLI (same as ngrok but supports non-random
   urls)
2. Log in to Loophole `$ loophole account login`
3. Start the proxy by running `$ loophole http 3000 --hostname hive-<your-name>` (@kamilkisiela I
   use `hive-kamil`). It creates `https://hive-<your-name>.loophole.site` endpoint.
4. Message @kamilkisiela and send him the url (He will update the list of accepted redirect urls in
   both Auth0 and Slack App).
5. Update `APP_BASE_URL` and `AUTH0_BASE_URL` in [`packages/web/app/.env`](./packages/web/app/.env)
6. Run `packages/web/app` and open `https://hive-<your-name>.loophole.site`.

> We have a special Slack channel called `#hive-tests` to not spam people :)

### Setting up GitHub App for developing

1. Follow the steps above for Slack App
2. Update `Setup URL` in
   [GraphQL Hive Development](https://github.com/organizations/the-guild-org/settings/apps/graphql-hive-development)
   app and set it to `https://hive-<your-name>.loophole.site/api/github/setup-callback`

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
   the verification link by visiting the email server's `/_history` endpoint -
   `http://localhost:6260/_history` by default.
   - Searching for `token` should help you find the link.

### Legacy Auth0 Integration

**Note:** If you are not working at The Guild, you can safely ignore this section.

Since we migrated from Auth0 to SuperTokens there is a compatibility layer for importing/migrating
accounts from Auth0 to SuperTokens.

By default, you don't need to set this up and can just use SuperTokens locally. However, if you need
to test some stuff or fix the Auth0 -> SuperTokens migration flow you have to set up some stuff.

1. Create your own Auth0 application
   1. If you haven't already, create an account on [manage.auth0.com](https://manage.auth0.com)
   2. Create a new application with the following settings:
      1. Type: `Regular Web Application`
      2. Allowed Callback URLs: `http://localhost:3000/api/callback`
      3. Allowed Logout URLs: `http://localhost:3000/`
   3. Create two Auth0 users
      1. This can be done from the "User Management" page
         - [`https://manage.auth0.com/dashboard/<REGION>/<DOMAIN>/users`](https://manage.auth0.com/dashboard/us/dev-azj17nyp/users)
   4. Create a new "Rule" in your Auth0 Account
      1. This can be done from the "Auth Pipeline -> Rules" section on the left navigation bar.
         - [`https://manage.auth0.com/dashboard/<REGION>/<DOMAIN>/rules`](https://manage.auth0.com/dashboard/us/dev-azj17nyp/rules)
      2. Enter the following code:
         ```js
         function (user, context, callback) {
           const namespace = 'https://graphql-hive.com';
           context.accessToken[namespace + '/metadata'] = user.user_metadata;
           context.idToken[namespace + '/metadata'] = user.user_metadata;
           context.accessToken[namespace + '/userinfo'] = {
             user_id: user.user_id,
             email: user.email,
             username: user.username,
             nickname: user.nickname
           };
           return callback(null, user, context);
         }
         ```
2. Update the `.env` secrets used by your local hive instance that are found when viewing your new
   application on Auth0:
   - `AUTH_LEGACY_AUTH0` (set this to `1` for enabling the migration.)
   - `AUTH_LEGACY_AUTH0_CLIENT_ID` (e.g. `rGSrExtM9sfilpF8kbMULkMNYI2SgXro`)
   - `AUTH_LEGACY_AUTH0_CLIENT_SECRET` (e.g.
     `gJjNQJsCaOC0nCKTgqWv2wvrh1XXXb-iqzVdn8pi2nSPq2TxxxJ9FIUYbNjheXxx`)
   - `AUTH_LEGACY_AUTH0_ISSUER_BASE_URL`(e.g. `https://foo-bars.us.auth0.com`)
   - `AUTH_LEGACY_AUTH0_AUDIENCE` (e.g. `https://foo-bars.us.auth0.com/api/v2/`)
