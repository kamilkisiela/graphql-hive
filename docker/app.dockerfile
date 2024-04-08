FROM node:21.7.2-slim

RUN apt-get update && apt-get install -y ca-certificates

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY --from=dist . /usr/src/app/
COPY --from=shared . /

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

ENTRYPOINT [ "/entrypoint.sh" ]
