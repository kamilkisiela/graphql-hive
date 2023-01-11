FROM rust:1-slim as build

WORKDIR /usr/src/router

# build
RUN apt-get update
RUN apt-get -y install npm protobuf-compiler curl
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
FROM debian:bullseye-slim

RUN apt-get update
RUN apt-get -y install ca-certificates

# Copy in the required files from our build image
COPY --from=build --chown=root:root /dist /dist

WORKDIR /dist

ENV APOLLO_ROUTER_CONFIG_PATH="/dist/config.yaml"

ENTRYPOINT ["/dist/router"]
