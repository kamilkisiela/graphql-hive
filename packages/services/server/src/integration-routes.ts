import { stringify } from 'node:querystring';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Registry } from '@hive/api';
import { Session, type AuthN } from '@hive/api/modules/auth/lib/authz';
import { GitHubIntegrationManager } from '@hive/api/modules/integrations/providers/github-integration-manager';
import type { IntegrationStateStore } from '@hive/api/modules/integrations/providers/integration-state-store';
import { SlackIntegrationManager } from '@hive/api/modules/integrations/providers/slack-integration-manager';
import { OrganizationManager } from '@hive/api/modules/organization/providers/organization-manager';
import { IdTranslator } from '@hive/api/modules/shared/providers/id-translator';
import { authenticateRequest } from './authenticate-request';

const OrganizationSlug = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

const StateModel = z.string().regex(/^[a-f0-9]{64}$/);

const GitHubCallbackQuery = z.object({
  installation_id: z
    .string({ required_error: 'Invalid installation_id' })
    .regex(/^\d+$/, 'Invalid installation_id'),
  code: z.string().min(1).max(1000).optional(),
  state: StateModel.optional(),
});

const GitHubAccessTokenResponse = z.object({
  access_token: z.string().min(1),
});

const SlackCallbackQuery = z.object({
  code: z.string({ required_error: 'Invalid code' }),
  state: StateModel,
});

const ConnectParams = z.object({
  organizationSlug: OrganizationSlug,
});

const SlackOAuthv2AccessResponse = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    access_token: z.string().min(1).max(1000),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

type IntegrationRoutesConfig = {
  publicUrl: string;
  webAppUrl: string;
  github: { appName: string; clientId: string; clientSecret: string } | null;
  slack: { clientId: string; clientSecret: string } | null;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  registry: Registry;
  authN: AuthN;
  stateStore: IntegrationStateStore;
};

type Injector = ReturnType<Registry['createOperationController']>['injector'];

export function registerIntegrationRoutes(
  server: FastifyInstance,
  config: IntegrationRoutesConfig,
) {
  const withInjector = createWithInjector(config);

  server.get(
    '/api/github/callback',
    withInjector(async (req, res, injector) => {
      const queryResult = GitHubCallbackQuery.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).send(queryResult.error.flatten().fieldErrors);
      }

      const { installation_id: installationId, code, state } = queryResult.data;
      req.log.info('GitHub callback (installationId=%s, hasState=%s)', installationId, !!state);

      if (!state) {
        // Installed from GitHub directly; only link back to an organization that already uses it.
        const organization = await injector
          .get(GitHubIntegrationManager)
          .getOrganization({ installation: installationId });

        return res.redirect(
          organization
            ? `${config.webAppUrl}/${organization.slug}/view/settings`
            : config.webAppUrl,
        );
      }

      if (!config.github) {
        throw new Error('GitHub is not set up.');
      }

      const cacheRecord = await config.stateStore.get(state);
      const viewer = await injector.get(Session).getViewer();

      if (cacheRecord?.method !== 'github' || cacheRecord.userId !== viewer.id) {
        return res.status(400).send('Invalid or expired state');
      }

      // The installation_id query parameter can be spoofed, so we verify that the GitHub user
      // who just authorized the app actually has access to the installation.
      if (
        !code ||
        !(await canUserAccessGitHubInstallation({
          github: config.github,
          fetch: config.fetch,
          code,
          installationId,
        }))
      ) {
        req.log.warn(
          'Could not verify GitHub installation access (installationId=%s)',
          installationId,
        );
        return res.status(403).send('Could not verify access to the GitHub installation');
      }

      await injector.get(GitHubIntegrationManager).register({
        organizationId: cacheRecord.organizationId,
        installationId,
      });

      const organization = await injector
        .get(OrganizationManager)
        .getOrganization({ organizationId: cacheRecord.organizationId });

      return res.redirect(`${config.webAppUrl}/${organization.slug}/view/settings`);
    }),
  );

  server.get(
    '/api/github/connect/:organizationSlug',
    withInjector(async (req, res, injector) => {
      if (!config.github) {
        throw new Error('GitHub is not set up.');
      }

      const paramsResult = ConnectParams.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).send(paramsResult.error.flatten().fieldErrors);
      }

      const { organizationSlug } = paramsResult.data;
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId({ organizationSlug });
      await injector.get(GitHubIntegrationManager).assertCanModify({ organizationId });
      const viewer = await injector.get(Session).getViewer();
      const state = await config.stateStore.put({
        method: 'github',
        organizationId,
        userId: viewer.id,
      });

      const redirectUrl = `${config.publicUrl}/api/github/callback`;
      const githubUrl = new URL(
        `https://github.com/apps/${config.github.appName}/installations/new`,
      );
      githubUrl.searchParams.set('state', state);
      githubUrl.searchParams.set('redirect_url', redirectUrl);

      return res.redirect(githubUrl.toString());
    }),
  );

  server.get(
    '/api/slack/callback',
    withInjector(async (req, res, injector) => {
      if (!config.slack) {
        throw new Error('The Slack integration is not enabled.');
      }

      const queryResult = SlackCallbackQuery.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).send(queryResult.error.flatten().fieldErrors);
      }

      const { code, state } = queryResult.data;
      const cacheRecord = await config.stateStore.get(state);
      const viewer = await injector.get(Session).getViewer();
      if (cacheRecord?.method !== 'slack' || cacheRecord.userId !== viewer.id) {
        return res.status(400).send('Invalid or expired state');
      }

      const redirectUrl = `${config.publicUrl}/api/slack/callback`;

      const slackResponse = await config
        .fetch('https://slack.com/api/oauth.v2.access', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: stringify({
            client_id: config.slack.clientId,
            client_secret: config.slack.clientSecret,
            code,
            redirect_uri: redirectUrl,
          }),
        })
        .then(response => response.json());

      const slackResponseResult = SlackOAuthv2AccessResponse.safeParse(slackResponse);

      if (!slackResponseResult.success) {
        return res.status(400).send('Failed to parse the response from Slack API');
      }

      if (!slackResponseResult.data.ok) {
        return res.status(400).send(slackResponseResult.data.error);
      }

      await injector.get(SlackIntegrationManager).register({
        organizationId: cacheRecord.organizationId,
        token: slackResponseResult.data.access_token,
      });

      const organization = await injector
        .get(OrganizationManager)
        .getOrganization({ organizationId: cacheRecord.organizationId });
      return res.redirect(`${config.webAppUrl}/${organization.slug}/view/settings`);
    }),
  );

  server.get(
    '/api/slack/connect/:organizationSlug',
    withInjector(async (req, res, injector) => {
      if (!config.slack) {
        throw new Error('The Slack integration is not enabled.');
      }

      const paramsResult = ConnectParams.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).send(paramsResult.error.flatten().fieldErrors);
      }

      const { organizationSlug } = paramsResult.data;
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId({ organizationSlug });

      await injector.get(SlackIntegrationManager).assertCanModify({ organizationId });
      const viewer = await injector.get(Session).getViewer();
      const state = await config.stateStore.put({
        method: 'slack',
        organizationId,
        userId: viewer.id,
      });

      const redirectUrl = `${config.publicUrl}/api/slack/callback`;
      const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
      slackUrl.searchParams.set('scope', 'incoming-webhook,chat:write,chat:write.public,commands');
      slackUrl.searchParams.set('client_id', config.slack.clientId);
      slackUrl.searchParams.set('state', state);
      slackUrl.searchParams.set('redirect_uri', redirectUrl);

      return res.redirect(slackUrl.toString());
    }),
  );
}

async function canUserAccessGitHubInstallation(args: {
  github: NonNullable<IntegrationRoutesConfig['github']>;
  fetch: IntegrationRoutesConfig['fetch'];
  code: string;
  installationId: string;
}): Promise<boolean> {
  const accessTokenResponse = await args.fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: args.github.clientId,
      client_secret: args.github.clientSecret,
      code: args.code,
    }),
  });

  if (accessTokenResponse.status !== 200) {
    return false;
  }

  const accessToken = GitHubAccessTokenResponse.safeParse(await accessTokenResponse.json());
  if (!accessToken.success) {
    return false;
  }

  const installationResponse = await args.fetch(
    `https://api.github.com/user/installations/${args.installationId}/repositories?per_page=1`,
    {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${accessToken.data.access_token}`,
        'x-github-api-version': '2022-11-28',
      },
    },
  );

  return installationResponse.status === 200;
}

function createWithInjector(config: IntegrationRoutesConfig) {
  return (
      handler: (req: FastifyRequest, reply: FastifyReply, injector: Injector) => Promise<unknown>,
    ) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const session = await authenticateRequest(config.authN, { req, reply });
      const controller = config.registry.createOperationController({
        context: {
          req,
          reply,
          requestId: req.id,
          headers: req.headers,
          session,
        },
      });

      try {
        return await controller.ɵrunWithContext(() => handler(req, reply, controller.injector));
      } finally {
        controller.destroy();
      }
    };
}
