import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';

export default async function slackConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  console.log('Connect to Slack');
  const orgId = req.query.orgId;
  console.log('Organization', orgId);

  const slackUrl = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook,chat:write,chat:write.public,commands&client_id=${env.slack.clientId}`;
  const redirectUrl = `${env.appBaseUrl.replace(/\/$/, '')}/api/slack/callback`;

  res.redirect(`${slackUrl}&state=${orgId}&redirect_uri=${redirectUrl}`);
}
