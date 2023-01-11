FROM rust:1-slim as build

WORKDIR /usr/src/router

# build
RUN apt-get update
RUN apt-get -y install npm protobuf-compiler curl
RUN rm -rf /var/lib/apt/lists/*
RUN update-ca-certificates
RUN rustup component add rustfmt

ENV RUST_BACKTRACE=1

COPY ./ .

RUN cargo build --release

RUN mkdir -p /dist/config \
  && mkdir /dist/schema \
  && mv target/release/router /dist
COPY router.yaml /dist/config.yaml

# final binary
FROM debian:bullseye-slim as runtime

RUN apt-get update
RUN apt-get -y install ca-certificates
RUN rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"

# Copy in the required files from our build image
COPY --from=build --chown=root:root /dist /dist

WORKDIR /dist

ENV APOLLO_ROUTER_CONFIG_PATH="/dist/config.yaml"

ENTRYPOINT ["/dist/router"]
