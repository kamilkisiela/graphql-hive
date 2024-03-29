FROM node:21.7.1-slim

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

ARG SERVICE_DIR_NAME

WORKDIR /usr/src/app/$SERVICE_DIR_NAME
COPY . /usr/src/app/$SERVICE_DIR_NAME/

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"
LABEL org.opencontainers.image.source="https://github.com/kamilkisiela/graphql-hive"

ENV ENVIRONMENT production
ENV RELEASE $RELEASE
ENV PORT $PORT

HEALTHCHECK --interval=5s \
  --timeout=5s \
  --start-period=5s \
  --retries=6 \
  CMD $HEALTHCHECK_CMD

CMD ["node", "index.js"]
