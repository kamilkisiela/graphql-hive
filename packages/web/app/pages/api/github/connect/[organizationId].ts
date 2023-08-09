import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';
import { getLogger } from '@/server-logger';

export default async function githubConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  const logger = getLogger(req);
  if (!env.github) {
    logger.error('GitHub is not set up.');
    throw new Error('GitHub is not set up.');
  }

  const { organizationId } = req.query;
  logger.info('Connect to GitHub (orgId=%s)', organizationId);

  const url = `https://github.com/apps/${env.github.appName}/installations/new`;

  const redirectUrl = `${env.appBaseUrl}/api/github/callback`;

  res.redirect(`${url}?state=${organizationId}&redirect_url=${redirectUrl}`);
}
