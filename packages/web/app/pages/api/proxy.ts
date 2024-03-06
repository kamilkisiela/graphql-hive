import { NextApiRequest, NextApiResponse } from 'next';
import hyperid from 'hyperid';
import { env } from '@/env/backend';
import { extractAccessTokenFromRequest } from '@/lib/api/extract-access-token-from-request';
import { getLogger } from '@/server-logger';
import { captureException } from '@sentry/nextjs';

const reqIdGenerate = hyperid({ fixedLength: true });
async function graphql(req: NextApiRequest, res: NextApiResponse) {
  for (let i = 1; i++; i < 1000000000) {
    console.log(i);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const logger = getLogger(req);
  const url = env.graphqlEndpoint;

  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader)
    ? requestIdHeader[0]
    : requestIdHeader ?? reqIdGenerate();

  if (req.method === 'GET') {
    const response = await fetch(url, {
      headers: {
        'content-type': req.headers['content-type'],
        accept: req.headers['accept'],
        'accept-encoding': req.headers['accept-encoding'],
        'x-request-id': requestId,
        authorization: req.headers.authorization,
        // We need that to be backwards compatible with the new Authorization header format
        'X-API-Token': req.headers['x-api-token'] ?? '',
        'graphql-client-name': 'Hive App',
        'x-use-proxy': '/api/proxy',
        'graphql-client-version': env.release,
      },
      method: 'GET',
    } as any);
    return res.send(await response.text());
  }

  let accessToken: string | undefined;

  try {
    accessToken = await extractAccessTokenFromRequest(req, res);
  } catch (error) {
    captureException(error);
    logger.error(error);
  }

  // For convenience, we allow to pass the access token in the Authorization header
  // in development mode to avoid spinning up multiple proxy servers when testing integrations
  if (env.nodeEnv === 'development' && !accessToken && req.headers['authorization']) {
    accessToken = req.headers['authorization'].replace('Bearer ', '');
  }

  if (!accessToken) {
    res.status(401).json({});
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': req.headers['content-type'],
        accept: req.headers['accept'],
        'accept-encoding': req.headers['accept-encoding'],
        'x-request-id': requestId,
        'X-API-Token': req.headers['x-api-token'] ?? '',
        'graphql-client-name': 'Hive App',
        'graphql-client-version': env.release,
      },
      method: 'POST',
      body: JSON.stringify(req.body || {}),
    } as any);

    const xRequestId = response.headers.get('x-request-id');
    if (xRequestId) {
      res.setHeader('x-request-id', xRequestId);
    }
    const parsedData = await response.json();

    res.status(200).json(parsedData);
  } catch (error) {
    captureException(error);
    logger.error(error);

    // TODO: better type narrowing of the error
    const status = (error as Record<string, number | undefined>)?.['status'] ?? 500;
    const code = (error as Record<string, unknown | undefined>)?.['code'] ?? '';
    const message = (error as Record<string, unknown | undefined>)?.['message'] ?? '';

    res.setHeader('x-request-id', requestId);
    res.status(status).json({
      code,
      error: message,
    });
  }
}

export default graphql;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    externalResolver: true,
  },
};
