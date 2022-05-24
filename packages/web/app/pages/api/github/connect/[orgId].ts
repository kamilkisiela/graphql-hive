import { NextApiRequest, NextApiResponse } from 'next';

export default async function githubConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  console.log('Connect to Github');
  const orgId = req.query.orgId;
  console.log('Organization', orgId);

  const url = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new`;

  const redirectUrl = `${process.env.APP_BASE_URL.replace(/\/$/, '')}/api/github/callback`;

  res.redirect(`${url}?state=${orgId}&redirect_url=${redirectUrl}`);
}
