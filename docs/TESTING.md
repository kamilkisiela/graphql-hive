# Testing

## Unit tests

We are using Jest. Simply run `pnpm test` to run all the tests.

## Integration Tests

We are using Dockest to test the following concerns:

1. Main application flows and integration of different services
2. Containerize execution of all services
3. Cross-service network calls

Integration tests are based pre-built Docker images, so you can run it in 2 modes:

#### Running from source code

To run integration tests locally, from the local source code, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune`
   to clean the Docker caches.
2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build source code: `pnpm build`
5. Set env vars:

```
export COMMIT_SHA="local"
export RELEASE="local"
export BRANCH_NAME="local"
export BUILD_TYPE=""
export DOCKER_TAG=":local"
```

6. Compile a local Docker image by running: `docker buildx bake -f docker.hcl build --load`
7. Pull the images: `docker-compose -f integration-tests/docker-compose.yml pull`
8. Run the tests: `pnpm --filter integration-tests dockest`

#### Running from pre-built Docker image

To run integration tests locally, from the pre-build Docker image, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune`
   to clean the Docker caches.
2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build source code: `pnpm build`
5. Decide on the commit ID / Docker image tag you would like to use.
6. Set the needed env vars:

```
export DOCKER_REGISTRY="ghcr.io/kamilkisiela/graphql-hive/"
export DOCKER_TAG=":IMAGE_TAG_HERE"
```

7. Pull the images: `docker-compose -f integration-tests/docker-compose.yml pull`
8. Run the tests: `pnpm --filter integration-tests dockest`

## e2e Tests

e2e Tests are based on Cypress, and matches files that ends with `.cy.ts`. The tests flow runs from
a pre-build Docker image.

#### Running from source code

To run e2e tests locally, from the local source code, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune`
   to clean the Docker caches.
2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build source code: `pnpm build`
5. Set env vars:

```
export COMMIT_SHA="local"
export RELEASE="local"
export BRANCH_NAME="local"
export BUILD_TYPE=""
export DOCKER_TAG=":local"
export HIVE_ENCRYPTION_SECRET=wowverysecuremuchsecret
export HIVE_EMAIL_FROM=no-reply@graphql-hive.com
export HIVE_APP_BASE_URL=http://localhost:8080
export SUPERTOKENS_API_KEY=wowverysecuremuchsecret
export CLICKHOUSE_USER=clickhouse
export CLICKHOUSE_PASSWORD=wowverysecuremuchsecret
export REDIS_PASSWORD=wowverysecuremuchsecret
export POSTGRES_PASSWORD=postgres
export POSTGRES_USER=postgres
export POSTGRES_DB=registry
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
export CDN_AUTH_PRIVATE_KEY=6b4721a99bd2ef6c00ce4328f34d95d7
```

6. Compile a local Docker image by running: `docker buildx bake -f docker.hcl build --load`
7. Run the e2e environment, by running:
   `docker compose -f docker-compose.community.yml up -d --wait`
8. Run Cypress: `pnpm test:e2e`

#### Running from pre-built Docker image

To run integration tests locally, from the pre-build Docker image, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune`
   to clean the Docker caches.
2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build source code: `pnpm build`
5. Decide on the commit ID / Docker image tag you would like to use.
6. Set the needed env vars:

```
export DOCKER_REGISTRY="ghcr.io/kamilkisiela/graphql-hive/"
export DOCKER_TAG=":IMAGE_TAG_HERE"
export HIVE_ENCRYPTION_SECRET=wowverysecuremuchsecret
export HIVE_EMAIL_FROM=no-reply@graphql-hive.com
export HIVE_APP_BASE_URL=http://localhost:8080
export SUPERTOKENS_API_KEY=wowverysecuremuchsecret
export CLICKHOUSE_USER=clickhouse
export CLICKHOUSE_PASSWORD=wowverysecuremuchsecret
export REDIS_PASSWORD=wowverysecuremuchsecret
export POSTGRES_PASSWORD=postgres
export POSTGRES_USER=postgres
export POSTGRES_DB=registry
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
export CDN_AUTH_PRIVATE_KEY=6b4721a99bd2ef6c00ce4328f34d95d7
```

7. Run the e2e environment, by running:
   `docker compose -f docker-compose.community.yml up -d --wait`
8. Run Cypress: `pnpm test:e2e`
