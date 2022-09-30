# Testing

## Unit tests

We are using Jest. Simply run `yarn test` to run all the tests.

## Integration Tests

We are using Dockest to test the following concerns:

1. Main application flows and integration of different services
2. Build and pack process of all packages
3. Containerize execution of all services
4. Cross-service network calls

To run integration tests locally, follow:

1. Make sure you have Docker installed. If you are having issues, try to run `docker system prune` to clean the Docker caches.
2. Install all deps: `yarn install`
3. Pull external images: `yarn workspace integration-tests run pull-external-images`
4. Build all services: `yarn workspace integration-tests run build:local`
5. Run the tests: `yarn workspace integration-tests run dockest`
