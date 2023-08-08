import { createServer } from 'http';
import { Router } from 'itty-router';
import { createServerAdapter } from '@whatwg-node/server';
import { createSignatureValidator } from './auth';
import { env } from './dev-polyfill';
import { handleRequest } from './handler';

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;
const isSignatureValid = createSignatureValidator(env.SIGNATURE);

function main() {
  const app = createServerAdapter(Router());

  app.get(
    '/_readiness',
    () =>
      new Response(null, {
        status: 200,
      }),
  );

  app.all('*', (request: Request) =>
    handleRequest(
      request,
      isSignatureValid,
      console,
      request.headers.get('x-request-id') ?? Math.random().toString(16).substring(2),
    ),
  );

  const server = createServer(app);

  return new Promise<void>(resolve => {
    server.listen(PORT, '::', resolve);
  });
}

main().catch(e => console.error(e));
