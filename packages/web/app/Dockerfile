FROM node:16-slim as install

WORKDIR /usr/src/app

COPY dist/ /usr/src/app/

ENV NODE_ENV production

# DANGER: there is no lockfile :)
# in the future this should be improved...

RUN npm install --legacy-peer-deps

FROM node:16-slim as app

WORKDIR /usr/src/app

COPY --from=install /usr/src/app/ /usr/src/app/

ENV ENVIRONMENT production
ENV RELEASE ${RELEASE}
ENV PORT 3000

CMD ["node", "index.js"]
