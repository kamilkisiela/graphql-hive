import supertokens from 'supertokens-node';
import { superTokensNextWrapper } from 'supertokens-node/nextjs';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { NextApiRequest, NextApiResponse } from 'next';
import { backendConfig } from '@/config/backend-config';

// yes, this has side-effects... thank you supertokens
supertokens.init(backendConfig());

export async function extractAccessTokenFromRequest(req: NextApiRequest, res: NextApiResponse): Promise<string> {
  await superTokensNextWrapper(async next => await verifySession()(req as any, res as any, next), req, res);
  // TODO: figure out what kind of error this can raise :)
  const accessToken = (req as any).session.getAccessToken();
  return accessToken;
}
