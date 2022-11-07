import supertokens from 'supertokens-node';
import { superTokensNextWrapper } from 'supertokens-node/nextjs';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { NextApiRequest, NextApiResponse } from 'next';
import { backendConfig } from '@/config/supertokens/backend';
import type { SessionContainerInterface } from 'supertokens-node/lib/build/recipe/session/types';

supertokens.init(backendConfig());

export async function extractAccessTokenFromRequest(req: NextApiRequest, res: NextApiResponse): Promise<string> {
  await superTokensNextWrapper(
    async next =>
      await verifySession({
        sessionRequired: false,
      })(req as any, res as any, next),
    req,
    res
  );
  const session: SessionContainerInterface | undefined = (req as any).session;
  // Session can be undefined in case no access token was sent.
  const accessToken = session?.getAccessToken() ?? null;

  if (accessToken === null) {
    throw new Error('Missing access token.');
  }

  return accessToken;
}
