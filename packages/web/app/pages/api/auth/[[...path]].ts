import { NextApiRequest, NextApiResponse } from 'next';
import type { Request, Response } from 'express';
import NextCors from 'nextjs-cors';
import supertokens from 'supertokens-node';
import { middleware } from 'supertokens-node/framework/express';
import { superTokensNextWrapper } from 'supertokens-node/nextjs';
import { backendConfig } from '@/config/supertokens/backend';
import { env } from '@/env/backend';

supertokens.init(backendConfig());

/**
 * Route for proxying to the underlying SuperTokens backend.
 */
export default async function superTokens(
  req: NextApiRequest & Request,
  res: NextApiResponse & Response,
) {
  // NOTE: We need CORS only if we are querying the APIs from a different origin
  await NextCors(req, res, {
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    origin: env.appBaseUrl,
    credentials: true,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
  });

  await superTokensNextWrapper(
    async next => {
      await middleware()(req, res, next);
    },
    req,
    res,
  );

  if (!res.writableEnded) {
    res.status(404).send('Not found');
  }
}
