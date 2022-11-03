import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';

export default async function slackConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  console.log('Connect to Slack');
  if (env.slack === null) {
    throw new Error('The Slack integration is not enabled.');
  }
  const orgId = req.query.orgId;
  console.log('Organization', orgId);

  const slackUrl = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook,chat:write,chat:write.public,commands&client_id=${env.slack.clientId}`;
  const redirectUrl = `${env.appBaseUrl}/api/slack/callback`;

  res.redirect(`${slackUrl}&state=${orgId}&redirect_uri=${redirectUrl}`);
}
