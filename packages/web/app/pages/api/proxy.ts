import { NextApiRequest, NextApiResponse } from 'next';
import { withSentry, captureException, startTransaction } from '@sentry/nextjs';
import type { Transaction } from '@sentry/types';
import { Readable } from 'stream';
import { auth0 } from '../../src/lib/auth0';
import hyperid from 'hyperid';
import { AccessTokenError } from '@auth0/nextjs-auth0';

const reqIdGenerate = hyperid({ fixedLength: true });

function useTransaction(res: any) {
  const existingTransaction: Transaction = res.__sentryTransaction;

  if (existingTransaction) {
    existingTransaction.setName('app.graphql');
    existingTransaction.op = 'app.graphql';

    return {
      transaction: existingTransaction,
      finish() {},
    };
  }

  const transaction = startTransaction({
    name: 'app.graphql',
    op: 'app.graphql',
  });

  return {
    transaction,
    finish() {
      transaction.finish();
    },
  };
}

async function graphql(req: NextApiRequest, res: NextApiResponse) {
  const url = process.env.GRAPHQL_ENDPOINT;

  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader ?? reqIdGenerate();

  if (req.method === 'GET') {
    const response = await fetch(url, {
      headers: {
        'content-type': req.headers['content-type'],
        accept: req.headers['accept'],
        'accept-encoding': req.headers['accept-encoding'],
        'x-request-id': requestId,
        'X-API-Token': req.headers['x-api-token'] ?? '',
        'graphql-client-name': 'Hive App',
        'x-use-proxy': '/api/proxy',
        'graphql-client-version': process.env.RELEASE ?? 'local',
      },
      method: 'GET',
    } as any);
    return res.send(await response.text());
  }

  const { transaction, finish: finishTransaction } = useTransaction(res);

  const accessSpan = transaction.startChild({
    op: 'app.accessToken',
  });

  let accessToken: string;

  try {
    const result = await auth0.getAccessToken(req, res);
    accessToken = result.accessToken;
  } catch (error) {
    if (error instanceof AccessTokenError && error.code !== 'invalid_session') {
      captureException(error);
    }
  }

  if (!accessToken) {
    accessSpan.setHttpStatus(401);
    accessSpan.finish();
    finishTransaction();

    res.status(401).send({});
    return;
  }

  accessSpan.setHttpStatus(200);

  const graphqlSpan = accessSpan.startChild({
    op: 'graphql',
  });

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'content-type': req.headers['content-type'],
        accept: req.headers['accept'],
        'accept-encoding': req.headers['accept-encoding'],
        'x-request-id': requestId,
        'X-API-Token': req.headers['x-api-token'] ?? '',
        'sentry-trace': transaction.toTraceparent(),
        'graphql-client-name': 'Hive App',
        'graphql-client-version': process.env.RELEASE ?? 'local',
      },
      method: 'POST',
      body: JSON.stringify(req.body || {}),
    } as any);

    const contentType = (response.headers && response.headers.get('Content-Type')) || '';
    const isStream = /multipart\/mixed/i.test(contentType);

    if (isStream) {
      graphqlSpan.setHttpStatus(response.status);
      const headers = {};

      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);

      const body = response.body as unknown as Readable;
      body.on('data', (chunk: Buffer) => {
        res.write(chunk.toString('utf8'));
      });
      body.on('end', () => {
        graphqlSpan.finish();
        finishTransaction();
        res.end();
      });
    } else {
      const xRequestId = response.headers.get('x-request-id');
      if (xRequestId) {
        res.setHeader('x-request-id', xRequestId);
      }
      const parsedData = await response.json();

      graphqlSpan.setHttpStatus(200);
      graphqlSpan.finish();
      finishTransaction();

      res.status(200).json(parsedData);
    }
  } catch (error) {
    console.error(error);
    captureException(error);

    graphqlSpan.setHttpStatus(500);
    graphqlSpan.finish();
    finishTransaction();

    // TODO: better type narrowing of the error
    const status = (error as Record<string, number | undefined>)?.['status'] ?? 500;
    const code = (error as Record<string, unknown | undefined>)?.['code'] ?? '';
    const message = (error as Record<string, unknown | undefined>)?.['message'] ?? '';

    res.status(status).json({
      code: code,
      error: message,
    });
  }
}

export default withSentry(graphql);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};
