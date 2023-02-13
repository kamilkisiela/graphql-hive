import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';

export default async function githubConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  console.log('Connect to Github');
  if (!env.github) {
    throw new Error('GitHub is not set up.');
  }

  const { orgId } = req.query;
  console.log('Organization', orgId);

  const url = `https://github.com/apps/${env.github.appName}/installations/new`;

  const redirectUrl = `${env.appBaseUrl}/api/github/callback`;

  res.redirect(`${url}?state=${orgId}&redirect_url=${redirectUrl}`);
}
