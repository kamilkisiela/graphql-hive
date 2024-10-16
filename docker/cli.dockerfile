FROM node:22.8.0-slim

RUN apt-get update && apt-get install -y ca-certificates

ARG CLI_VERSION

WORKDIR /usr/src/app

RUN npm install --global @graphql-hive/cli@${CLI_VERSION}

LABEL org.opencontainers.image.licenses=MIT
LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/graphql-hive/platform"
LABEL org.opencontainers.image.source="https://github.com/graphql-hive/platform"

ENV ENVIRONMENT production
ENV RELEASE $RELEASE
RUN hive --version

ENTRYPOINT ["hive"]
