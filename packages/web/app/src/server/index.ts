import { resolve } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import FastifyStatic from '@fastify/static';
import { env, getPublicEnvVars } from '../env/backend';
import { connectGithub } from './github';
import { connectLab } from './lab';
import { connectSlack } from './slack';

const __dirname = new URL('.', import.meta.url).pathname;
/**
 * Whether the server is running in development mode.
 */
const isDev = process.argv.includes('--dev');

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
    // If in development mode, use Vite to serve the frontend and enable hot module reloading.
    const { default: FastifyVite } = await import('@fastify/vite');
    await server.register(FastifyVite, {
      // The root directory of @hive/app (where the package.json is located)
      // /
      // ├── /src
      // │   └── /server
      // │       └── index.ts
      // └── package.json
      root: resolve(__dirname, '../..'),
      dev: true,
      spa: true,
    });
    await server.vite.ready();
  } else {
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

  connectSlack(server);
  connectGithub(server);
  connectLab(server);

  server.get('*', (_req, reply) => {
    if (isDev) {
      // If in development mode, return the Vite index.html.
      return reply.html();
    }

    // If in production mode, return the static index.html.
    return reply.sendFile('index.html', {
      cacheControl: false,
    });
  });

  await server.listen({ port: env.port, host: '::' });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
