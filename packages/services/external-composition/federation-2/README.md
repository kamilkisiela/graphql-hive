# Composition Service for Apollo Federation 2

# Background

Hive comes with support for Apollo Federation v2, based on
[external composition](https://docs.graphql-hive.com/features/external-schema-composition).

This package provides a reference for running external composition as a NodeJS service, on your
local infrastructure, and connect GraphQL Hive (Cloud or self-service).

# Usage

Start by deciding on your encryption secret. This is needed in order to ensure you endpoint is
secured and can be triggered only by Hive platform. Your secret can be any string you decide, and it
will be used as private key to hash the requests to your composition service.

We are going to use that secret later as `SECERT` env var, and also in Hive dashboard.

## Running as Docker container

You can run this service as Docker container
(`ghcr.io/kamilkisiela/graphql-hive/composition-federation-2`), from the published
[Docker image we provide](https://github.com/kamilkisiela/graphql-hive/pkgs/container/graphql-hive%2Fcomposition-federation-2).

To run the service, use the following command:

```
docker run -p 3069 -e SECRET="MY_SECRET_HERE" ghcr.io/kamilkisiela/graphql-hive/composition-federation-2
```

The container runs on port `3069` by default (you can chnage it using `PORT` env var), and listens
to `POST /compose` requests coming from Hive platform.

You should make this service publicly available and accessible to use it with Hive Cloud platform,
or make it availble in your local/private network if you are using Hive on-prem.

## Running from source code

You can clone this repository, install dependencies (`pnpm install`) and then run this service
directly, by running:

```
cd packages/services/external-composition/federation-2
export SECRET="MY_SECRET_HERE"
pnpm dev
```

Or, to run the built version:

```
cd packages/services/external-composition/federation-2
pnpm build
export SECRET="MY_SECRET_HERE"
node dist/index.js
```

## Hive Integration

[Here you can find instructions on how to integrate your external composition service with Hive](https://docs.graphql-hive.com/features/external-schema-composition#configuration).

You'll need to use the public address of your service, and the secret you selected.

The service created here listens to `POST /compose` requests, so the endpoint you are using should
be composed from the public endpoint of this service, and the `/compose` path.
