import './dev-polyfill';
import { createServer } from '@hive/service-common';
import { handleRequest } from './handler';
import { devStorage } from './dev-polyfill';
import { isKeyValid } from './auth';
import { createServerAdapter } from '@whatwg-node/server';
import { Router } from 'itty-router';
import { withParams, json } from 'itty-router-extras';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

function main() {
  const app = createServerAdapter(Router());

  app.put(
    '/:accountId/storage/kv/namespaces/:namespaceId/values/:key',
    withParams,
    async (
      request: Request & {
        params: {
          accountId: string;
          namespaceId: string;
          key: string;
        };
      }
    ) => {
      if (!request.params.key) {
        throw new Error(`Missing key`);
      }

      const textBody = await request.text();

      if (!textBody) {
        throw new Error(`Missing body value`);
      }

      console.log(`Writing to ephermal storage: ${request.params.key}, value: ${request.body}`);

      devStorage.set(request.params.key, textBody);

      return json({
        success: true,
      });
    }
  );

  app.get('/dump', () => json(Object.fromEntries(devStorage.entries())));

  app.get(
    '/_readiness',
    () =>
      new Response(null, {
        status: 200,
      })
  );

  app.get('*', (request: Request) => handleRequest(request, isKeyValid));

  const server = createServer(app);

  return new Promise<void>(resolve => {
    server.listen(PORT, '0.0.0.0', resolve);
  });
}

main().catch(e => console.error(e));
