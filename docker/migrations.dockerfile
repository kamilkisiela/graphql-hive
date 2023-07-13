FROM node:18.16.1-slim

RUN apt-get update && apt-get install -y ca-certificates

WORKDIR /usr/src/app
COPY . /usr/src/app/

ENV ENVIRONMENT production
ENV NODE_ENV production

CMD ["npm", "run", "db:migrator", "up"]
