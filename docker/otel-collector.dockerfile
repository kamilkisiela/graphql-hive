FROM scratch AS config

COPY builder-config.yaml .
COPY extension-hiveauth/ ./extension-hiveauth/
COPY extension-statsviz/ ./extension-statsviz/

FROM golang:1.26-bookworm AS builder

ARG OTEL_VERSION=0.162.0

WORKDIR /build

RUN go install go.opentelemetry.io/collector/cmd/builder@v${OTEL_VERSION}

# Copy the manifest file and other necessary files
COPY --from=config builder-config.yaml .
COPY --from=config extension-hiveauth/ ./extension-hiveauth/
COPY --from=config extension-statsviz/ ./extension-statsviz/

# Build the custom collector
RUN CGO_ENABLED=0 builder --config=/build/builder-config.yaml

# Stage 2: Final Image
FROM alpine:3.22

WORKDIR /app

# Copy the generated collector binary from the builder stage
COPY --from=builder /build/otelcol-custom .
COPY config.yaml /etc/otel-config.yaml

# Create directory for queue storage
RUN mkdir -p /var/lib/otelcol/file_storage

# Expose necessary ports
EXPOSE 4317/tcp 4318/tcp 13133/tcp 1777/tcp 8081/tcp 55679/tcp

# Set the default command
CMD ["./otelcol-custom", "--config=/etc/otel-config.yaml"]
