import { NextApiRequest, NextApiResponse } from 'next';
import supertokens from 'supertokens-node';
import { SessionContainerInterface } from 'supertokens-node/lib/build/recipe/session/types';
import { superTokensNextWrapper } from 'supertokens-node/nextjs';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { backendConfig } from '@/config/supertokens/backend';

supertokens.init(backendConfig());

export async function extractAccessTokenFromRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string> {
  await superTokensNextWrapper(
    async next =>
      await verifySession({
        sessionRequired: false,
        checkDatabase: true,
      })(req as any, res as any, next),
    req,
    res,
  );
  const { session } = req as { session?: SessionContainerInterface };
  // Session can be undefined in case no access token was sent.
  const accessToken = session?.getAccessToken() ?? null;

  if (accessToken === null) {
    throw new Error('Missing access token.');
  }

  return accessToken;
}
