FROM rust:1-slim as build

WORKDIR /usr/src/router

# build
RUN apt update && apt install -y curl nodejs npm
RUN update-ca-certificates
RUN rustup component add rustfmt

COPY ./ .
RUN cargo build --release

# final binary
FROM debian:bullseye-slim

RUN mkdir /app
COPY --from=build /usr/src/router/target/release/router /app

ENTRYPOINT /app/router
