import { stringify } from 'node:querystring';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '@/env/backend';
import { graphql } from './utils';

const CallBackQuery = z.object({
  code: z.string({
    required_error: 'Invalid code',
  }),
  state: z.string({
    required_error: 'Invalid state',
  }),
});

const ConnectParams = z.object({
  organizationId: z.string({
    required_error: 'Invalid organizationId',
  }),
});

export function connectSlack(server: FastifyInstance) {
  server.get('/api/slack/callback', async (req, res) => {
    if (env.slack === null) {
      throw new Error('The Slack integration is not enabled.');
    }

    const queryResult = CallBackQuery.safeParse(req.query);

    if (!queryResult.success) {
      void res.status(400).send(queryResult.error.flatten().fieldErrors);
      return;
    }

    const { code, state: orgId } = queryResult.data;

    req.log.info('Fetching data from Slack API (orgId=%s)', orgId);

    const slackResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: stringify({
        client_id: env.slack.clientId,
        client_secret: env.slack.clientSecret,
        code,
      }),
    }).then(res => res.json());

    const token = slackResponse.access_token;

    await graphql({
      url: env.graphqlPublicEndpoint,
      headers: {
        ...req.headers,
        'content-type': 'application/json',
        'graphql-client-name': 'Hive App',
        'graphql-client-version': env.release,
      },
      operationName: 'addSlackIntegration',
      query: /* GraphQL */ `
        mutation addSlackIntegration($input: AddSlackIntegrationInput!) {
          addSlackIntegration(input: $input)
        }
      `,
      variables: {
        input: {
          organization: orgId,
          token,
        },
      },
    });
    void res.redirect(`/${orgId}/view/settings`);
  });

  server.get('/api/slack/connect/:organizationId', async (req, res) => {
    req.log.info('Connect to Slack');
    if (env.slack === null) {
      req.log.error('The Slack integration is not enabled.');
      throw new Error('The Slack integration is not enabled.');
    }

    const paramsResult = ConnectParams.safeParse(req.params);
    if (!paramsResult.success) {
      void res.status(400).send(paramsResult.error.flatten().fieldErrors);
      return;
    }

    const { organizationId } = paramsResult.data;
    req.log.info('Connect organization to Slack (id=%s)', organizationId);

    const slackUrl = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook,chat:write,chat:write.public,commands&client_id=${env.slack.clientId}`;
    const redirectUrl = `${env.appBaseUrl}/api/slack/callback`;

    void res.redirect(`${slackUrl}&state=${organizationId}&redirect_uri=${redirectUrl}`);
  });
}
