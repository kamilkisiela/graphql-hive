import './dev-polyfill';
import { createServer } from 'http';
import { createRequestHandler } from './handler';
import { devStorage } from './dev-polyfill';
import { createServerAdapter } from '@whatwg-node/server';
import { Router } from 'itty-router';
import { withParams, json } from 'itty-router-extras';
import { createIsKeyValid } from './key-validation';

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

/**
 * KV Storage for the CDN
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare let HIVE_DATA: KVNamespace;

/**
 * Secret used to sign the CDN keys
 */
declare let KEY_DATA: string;

const handleRequest = createRequestHandler({
  getRawStoreValue: value => HIVE_DATA.get(value),
  isKeyValid: createIsKeyValid({ keyData: KEY_DATA }),
});

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
      },
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
    },
  );

  app.get('/dump', () => json(Object.fromEntries(devStorage.entries())));

  app.get(
    '/_readiness',
    () =>
      new Response(null, {
        status: 200,
      }),
  );

  app.get('*', (request: Request) => handleRequest(request));

  const server = createServer(app);

  return new Promise<void>(resolve => {
    server.listen(PORT, '0.0.0.0', resolve);
  });
}

main().catch(e => console.error(e));
