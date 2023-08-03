#!/usr/bin/env node
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const { parse } = require('node:url');
const next = require('next');

const requestIdAsyncLocalStorage = new AsyncLocalStorage();

const loggerHandler = require('pino-http')({
  redact: ['headers', 'req.headers', 'res.headers'],
  quietReqLogger: true,
  autoLogging: {
    ignore(req) {
      const isApi = req.url.startsWith('/api');
      const isAuth = req.url.startsWith('/auth');
      return !isApi && !isAuth;
    },
  },
  genReqId(req, res) {
    const existingID = req.id ?? req.headers['x-request-id'];
    if (existingID) {
      return existingID;
    }
    const id = randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  mixin() {
    const reqId = requestIdAsyncLocalStorage.getStore();
    if (reqId) {
      return { reqId };
    }
    return {};
  },
});

const logger = loggerHandler.logger;
// server-logger.ts will reuse this logger instance
globalThis.logger = logger;

// <-- additionalRequire -->

const port = parseInt(process.env.PORT);
const hostname = '0.0.0.0';
const app = next({ dev: false, hostname, conf: {}, port, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      loggerHandler(req, res);
      const parsedUrl = parse(req.url, true);
      requestIdAsyncLocalStorage.run(req.id, () => {
        handle(req, res, parsedUrl);
      });
    }).listen(port);

    logger.info(`Server listening at http://${hostname}:${port}`);
  })
  .catch(error => {
    logger.error(error);
    process.exit(1);
  });
