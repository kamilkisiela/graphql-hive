FROM node:16.13.2-alpine3.14

ARG POSTGRES_HOST=localhost
ARG CLICKHOUSE_HOST=localhost
ARG REDIS_HOST=localhost

# Needed by turbo build when checking diffs (or something)
RUN apk add --no-cache git

# Prep app folder
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install dependencies
COPY . .
RUN yarn install

# Generate build artifacts
RUN yarn workspace '@hive/storage' db
RUN yarn generate
RUN yarn build
