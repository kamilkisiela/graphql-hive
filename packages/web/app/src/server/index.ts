import { resolve } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import FastifyStatic from '@fastify/static';
import { env, getPublicEnvVars } from '../env/backend';
import { connectLab } from './lab';
import { registerPreflightWorkerEmbedRoute } from './preflight-embed';

const __dirname = new URL('.', import.meta.url).pathname;
// The root directory of @hive/app (where the package.json is located)
// /
// ├── /src
// │   └── /server
// │       └── index.ts
// └── package.json
const appRoot = resolve(__dirname, '../..');
/**
 * Whether the server is running in development mode.
 * See the ./dev.ts file
 */
// eslint-disable-next-line no-process-env
const isDev = process.env.NODE_ENV === 'development';

const server = Fastify({
  disableRequestLogging: true,
  logger: {
    level: env.log.level,
  },
});

async function main() {
  /**
   * Why is this necessary?
   *
   * @fastify/vite in production mode needs the vite.config.js file to be present, but we don't really need it as we're not using SSR and stuff.
   * We're just going to serve the frontend as static files in production mode.
   *
   * In development mode, we're going to use @fastify/vite for hot module reloading, pre-bundling dependencies, etc.
   */
  if (isDev) {
    server.log.info('Running in development mode');
    // If in development mode, use Vite to serve the frontend and enable hot module reloading.
    const { default: FastifyVite } = await import('@fastify/vite');

    await server.register(FastifyVite, {
      root: appRoot,
      dev: true,
      spa: true,
    });

    await server.vite.ready();
  } else {
    server.log.info('Running in production mode');
    // If in production mode, serve the frontend as static files.
    await server.register(FastifyStatic, {
      // The root directory of the frontend code (where the index.html is located)
      // /dist
      // ├── /client
      // │   └── index.html
      // └── index.js
      root: resolve(__dirname, 'client'),
      // Prevent fastify/static from creating '*' route.
      // We want to define our own '*' route to handle all requests.
      wildcard: false,
    });
  }

  await server.register(cors, {
    credentials: true,
  });

  server.get('/api/health', (_req, res) => {
    return res.status(200).send('OK');
  });

  // Exposes environment variables to the frontend as a JavaScript object.
  server.get('/__env.js', (_req, res) => {
    const publicEnvVars = getPublicEnvVars();
    return res
      .status(200)
      .header('content-type', 'text/javascript')
      .header('cache-control', 'no-cache')
      .send(`window.__ENV = ${JSON.stringify(publicEnvVars)};`);
  });

  connectLab(server);

  registerPreflightWorkerEmbedRoute(
    server,
    isDev
      ? {
          appRoot,
          transformHtml: (url, html) => {
            const devServer = server.vite.devServer;
            if (!devServer) {
              throw new Error('Vite dev server is not ready');
            }
            return devServer.transformIndexHtml(url, html);
          },
        }
      : null,
  );

  server.get('*', (req, reply) => {
    // Never serve the SPA shell for a missing asset. Browsers require JavaScript
    // module requests to receive JavaScript, not an HTML fallback.
    if (req.url.startsWith('/assets/')) {
      return reply
        .code(404)
        .header('cache-control', 'public, max-age=10, s-maxage=10, must-revalidate')
        .send({ error: 'Asset not found' });
    }

    if (isDev) {
      // If in development mode, return the Vite index.html.
      return reply.html();
    }

    // If in production mode, return the static index.html.
    return reply.sendFile('index.html', {
      cacheControl: false,
    });
  });

  await server.listen({
    port: env.port,
    host: env.host,
    ipv6Only: env.ipv6Only,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
