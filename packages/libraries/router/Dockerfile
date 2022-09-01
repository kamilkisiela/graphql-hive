FROM --platform=linux/amd64 rust:1-slim as build

WORKDIR /usr/src/router

# build
RUN apt update && apt install -y curl nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates
RUN rustup component add rustfmt

COPY ./ .
RUN cargo build --release

# final binary
FROM --platform=linux/amd64 debian:bullseye-slim

RUN apt update && apt install -y ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=build /usr/src/router/target/release/router .

ENTRYPOINT ["./router"]
