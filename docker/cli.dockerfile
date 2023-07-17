FROM node:18.16.1-slim

RUN apt-get update && apt-get install -y ca-certificates

WORKDIR /usr/src/app
COPY . /usr/src/app/

RUN npm install --omit=dev
RUN npm install -g file:./

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"

ENV ENVIRONMENT production
ENV RELEASE $RELEASE
RUN npx hive --version

ENTRYPOINT ["npx", "hive"]
