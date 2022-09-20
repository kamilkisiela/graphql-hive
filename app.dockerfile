FROM node:16-slim as install

WORKDIR /usr/src/app

COPY . /usr/src/app/

ENV NODE_ENV production

# DANGER: there is no lockfile :)
# in the future this should be improved...

RUN npm install --legacy-peer-deps

FROM node:16-slim as app

WORKDIR /usr/src/app

COPY --from=install /usr/src/app/ /usr/src/app/

LABEL org.opencontainers.image.title=$IMAGE_TITLE
LABEL org.opencontainers.image.version=$RELEASE
LABEL org.opencontainers.image.description=$IMAGE_DESCRIPTION
LABEL org.opencontainers.image.authors="The Guild"
LABEL org.opencontainers.image.vendor="Kamil Kisiela"
LABEL org.opencontainers.image.url="https://github.com/kamilkisiela/graphql-hive"

ENV ENVIRONMENT production
ENV RELEASE $RELEASE
ENV PORT 3000

CMD ["node", "index.js"]
