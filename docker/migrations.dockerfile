FROM node:20.5.0-slim

RUN apt-get update && apt-get install -y ca-certificates

WORKDIR /usr/src/app
COPY . /usr/src/app/

ENV ENVIRONMENT production
ENV NODE_ENV production

CMD ["node", "index.js"]
