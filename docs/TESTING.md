# Testing

## Unit tests

We are using Jest. Simply run `pnpm test` to run all the tests.

## Integration Tests

We are using Dockest to test the following concerns:

1. Main application flows and integration of different services
2. Build and pack process of all packages
3. Containerize execution of all services
4. Cross-service network calls

To run integration tests locally, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune` to clean the Docker caches.
2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build and pack all services: `pnpm --filter integration-tests build-and-pack`
5. Pull the images: `docker-compose -f integration-tests/docker-compose.yml pull`
6. Run the tests: `pnpm --filter integration-tests dockest`
