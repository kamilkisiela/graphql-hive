FROM node:18.17.1-slim

RUN apt-get update && apt-get install -y ca-certificates

WORKDIR /usr/src/app

COPY package.json /usr/src/app

RUN npm install --omit=dev

COPY . /usr/src/app/

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"

ENV ENVIRONMENT production
ENV RELEASE $RELEASE
RUN npx . --version

ENTRYPOINT ["npx", "."]
