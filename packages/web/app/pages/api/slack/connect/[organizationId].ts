import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';
import { getLogger } from '@/server-logger';

export default async function slackConnectOrg(req: NextApiRequest, res: NextApiResponse) {
  const logger = getLogger(req);
  logger.info('Connect to Slack');
  if (env.slack === null) {
    logger.error('The Slack integration is not enabled.');
    throw new Error('The Slack integration is not enabled.');
  }
  const { orgId } = req.query;
  logger.info('Connect organization to Slack (id=%s)', orgId);

  const slackUrl = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook,chat:write,chat:write.public,commands&client_id=${env.slack.clientId}`;
  const redirectUrl = `${env.appBaseUrl}/api/slack/callback`;

  res.redirect(`${slackUrl}&state=${orgId}&redirect_uri=${redirectUrl}`);
}
