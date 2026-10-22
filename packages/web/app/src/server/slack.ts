import { stringify } from 'node:querystring';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '@/env/backend';
import { graphql } from '@/gql';
import { graphqlRequest } from './utils';

const SlackIntegration_addSlackIntegration = graphql(/* GraphQL */ `
  mutation SlackIntegration_addSlackIntegration($input: AddSlackIntegrationInput!) {
    addSlackIntegration(input: $input)
  }
`);

const OrganizationSlug = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

const CallBackQuery = z.object({
  code: z.string({
    required_error: 'Invalid code',
  }),
  state: OrganizationSlug,
});

const ConnectParams = z.object({
  organizationSlug: OrganizationSlug,
});

const SlackOAuthv2AccessResponse = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    access_token: z.string(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export function connectSlack(server: FastifyInstance) {
  server.get('/api/slack/callback', async (req, res) => {
    if (env.slack === null) {
      throw new Error('The Slack integration is not enabled.');
    }

    const queryResult = CallBackQuery.safeParse(req.query);

    if (!queryResult.success) {
      req.log.error('Received invalid data from Slack API.');
      void res.status(400).send(queryResult.error.flatten().fieldErrors);
      return;
    }

    const { code, state: organizationSlug } = queryResult.data;

    req.log.info('Fetching data from Slack API (orgId=%s)', organizationSlug);

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

    const slackResponseResult = SlackOAuthv2AccessResponse.safeParse(slackResponse);

    if (!slackResponseResult.success) {
      req.log.error('Error parsing data from Slack API (orgId=%s)', organizationSlug);
      req.log.error(slackResponseResult.error.toString());
      void res.status(400).send('Failed to parse the response from Slack API');
      return;
    }

    if (!slackResponseResult.data.ok) {
      req.log.error('Failed to retrieve access token from Slack API (orgId=%s)', organizationSlug);
      req.log.error(slackResponseResult.data.error);
      void res.status(400).send(slackResponseResult.data.error);
      return;
    }

    const token = slackResponseResult.data.access_token;

    const result = await graphqlRequest({
      url: env.graphqlPublicEndpoint,
      headers: {
        ...req.headers,
        'content-type': 'application/json',
        'graphql-client-name': 'hive-app',
        'graphql-client-version': env.release,
      },
      operationName: 'SlackIntegration_addSlackIntegration',
      document: SlackIntegration_addSlackIntegration,
      variables: {
        input: {
          organizationSlug,
          token,
        },
      },
    });

    if (result.errors) {
      req.log.error('Failed setting slack token (orgId=%s)', organizationSlug);
      for (const error of result.errors) {
        req.log.error(error);
      }
      throw new Error('Failed setting slack token.');
    }

    void res.redirect(`/${organizationSlug}/view/settings`);
  });

  server.get('/api/slack/connect/:organizationSlug', async (req, res) => {
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

    const { organizationSlug } = paramsResult.data;
    req.log.info('Connect organization to Slack (id=%s)', organizationSlug);

    const slackUrl = `https://slack.com/oauth/v2/authorize?scope=incoming-webhook,chat:write,chat:write.public,commands&client_id=${env.slack.clientId}`;
    const redirectUrl = `${env.appBaseUrl}/api/slack/callback`;

    void res.redirect(`${slackUrl}&state=${organizationSlug}&redirect_uri=${redirectUrl}`);
  });
}
