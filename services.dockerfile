FROM node:16-slim

WORKDIR /usr/src/app
COPY . /usr/src/app/

CMD ["node", "index.js"]
