FROM node:18.19.0-slim

RUN apt-get update && apt-get install -y ca-certificates

WORKDIR /usr/src/app
COPY . /usr/src/app/

ENV ENVIRONMENT production
ENV NODE_ENV production

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"
LABEL org.opencontainers.image.source="https://github.com/kamilkisiela/graphql-hive"

CMD ["node", "index.js"]
