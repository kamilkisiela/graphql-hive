import './dev-polyfill';
import type { FastifyRequest } from 'fastify';
import { createServer } from '@hive/service-common';
import { handleRequest } from './handler';
import type { ServerResponse } from 'http';
import { Readable } from 'stream';
import { devStorage } from './dev-polyfill';
import { isKeyValid } from './auth';

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

function isReadable(responseBody: any): responseBody is Readable {
  return !!responseBody.pipe;
}

export interface AddressInfo {
  protocol: 'http' | 'https';
  hostname: string;
  endpoint: string;
  port: number;
}

export function sendNodeResponse(
  { headers, status, statusText, body }: Response,
  serverResponse: ServerResponse
): void {
  headers.forEach((value, name) => {
    serverResponse.setHeader(name, value);
  });
  serverResponse.statusCode = status;
  serverResponse.statusMessage = statusText;
  // Some fetch implementations like `node-fetch`, return `Response.body` as Promise
  if (body == null) {
    serverResponse.end();
  } else {
    const nodeStream = (isReadable(body) ? body : Readable.from(body)) as Readable;
    nodeStream.pipe(serverResponse);
  }
}

function getRequestAddressInfo(nodeRequest: FastifyRequest, defaultAddressInfo: AddressInfo): AddressInfo {
  const hostnameWithPort = nodeRequest.hostname ?? nodeRequest.headers.host ?? defaultAddressInfo.hostname;
  const [hostname = nodeRequest.hostname, port = defaultAddressInfo.port] = hostnameWithPort.split(':');
  return {
    protocol: nodeRequest.protocol ?? defaultAddressInfo.protocol,
    hostname,
    endpoint: nodeRequest.url ?? defaultAddressInfo.endpoint,
    port,
  } as AddressInfo;
}

function buildFullUrl(addressInfo: AddressInfo) {
  return `${addressInfo.protocol}://${addressInfo.hostname}:${addressInfo.port}${addressInfo.endpoint}`;
}

export async function getNodeRequest(nodeRequest: FastifyRequest, defaultAddressInfo: AddressInfo): Promise<Request> {
  const addressInfo = getRequestAddressInfo(nodeRequest, defaultAddressInfo);
  const fullUrl = buildFullUrl(addressInfo);
  const baseRequestInit: RequestInit = {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
  };

  if (nodeRequest.method !== 'POST') {
    return new Request(fullUrl, baseRequestInit);
  }

  const maybeParsedBody = nodeRequest.body;
  if (maybeParsedBody) {
    return new Request(fullUrl, {
      ...baseRequestInit,
      body: typeof maybeParsedBody === 'string' ? maybeParsedBody : JSON.stringify(maybeParsedBody),
    });
  }

  const rawRequest = nodeRequest.raw || nodeRequest.req || nodeRequest;
  return new Request(fullUrl, {
    headers: nodeRequest.headers,
    method: nodeRequest.method,
    body: rawRequest as any,
  });
}

async function main() {
  const server = await createServer({
    tracing: false,
    name: 'local_cdn',
  });

  server.route<{
    Params: {
      accountId: string;
      namespaceId: string;
      key: string;
    };
  }>({
    url: '/:accountId/storage/kv/namespaces/:namespaceId/values/:key',
    method: 'PUT',
    handler: async request => {
      if (!request.params.key) {
        throw new Error(`Missing key`);
      }

      if (!request.body) {
        throw new Error(`Missing body value`);
      }

      console.log(`Writing to ephermal storage: ${request.params.key}, value: ${request.body}`);

      devStorage.set(request.params.key, request.body as string);

      return {
        success: true,
      };
    },
  });

  server.route({
    url: '/dump',
    method: 'GET',
    handler: async () => {
      return Object.fromEntries(devStorage.entries());
    },
  });

  server.route({
    url: '/_readiness',
    method: 'GET',
    handler: async (_, res) => {
      res.status(200).send();
    },
  });

  server.route({
    url: '*',
    method: ['GET'],
    handler: async (req, reply) => {
      const response = await handleRequest(
        await getNodeRequest(req, {
          hostname: 'localhost',
          port: PORT,
          protocol: 'http',
          endpoint: '/',
        }),
        isKeyValid
      );

      sendNodeResponse(response, reply.raw);
    },
  });

  await server.listen(PORT, '0.0.0.0');
}

main().catch(e => console.error(e));
