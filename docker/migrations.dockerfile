FROM node:18.16.0-slim

WORKDIR /usr/src/app
COPY . /usr/src/app/

ENV ENVIRONMENT production
ENV NODE_ENV production

CMD ["npm", "run", "db:migrator", "up"]
