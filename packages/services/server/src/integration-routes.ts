import { stringify } from 'node:querystring';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Registry } from '@hive/api';
import type { AuthN } from '@hive/api/modules/auth/lib/authz';
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

const OAuthState = z.string().regex(/^[a-f0-9]{64}$/);

const GitHubCallbackQuery = z.object({
  installation_id: z.string({ required_error: 'Invalid installation_id' }),
  state: OAuthState,
});

const GitHubSetupCallbackQuery = z.object({
  installation_id: z.string({ required_error: 'Invalid installation_id' }),
  state: OAuthState.optional(),
});

const SlackCallbackQuery = z.object({
  code: z.string({ required_error: 'Invalid code' }),
  state: OAuthState,
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
  github: { appName: string } | null;
  slack: { clientId: string; clientSecret: string } | null;
  registry: Registry;
  authN: AuthN;
  stateStore: IntegrationStateStore;
};

export function registerIntegrationRoutes(
  server: FastifyInstance,
  config: IntegrationRoutesConfig,
) {
  server.get('/api/github/callback', async (req, res) => {
    const queryResult = GitHubCallbackQuery.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).send(queryResult.error.flatten().fieldErrors);
    }

    const { installation_id: installationId, state } = queryResult.data;
    const cacheRecord = await config.stateStore.get(state);

    if (cacheRecord?.method !== 'github') {
      return res.status(400).send('Invalid or expired state');
    }

    await withOperation(config, req, res, async injector => {
      await injector.get(GitHubIntegrationManager).register({
        organizationId: cacheRecord.organizationId,
        installationId,
      });
    });
    const organization = await getOrganization(config, req, res, cacheRecord.organizationId);
    return res.redirect(`${config.publicUrl}/${organization.slug}/view/settings`);
  });

  server.get('/api/github/setup-callback', async (req, res) => {
    const queryResult = GitHubSetupCallbackQuery.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).send(queryResult.error.flatten().fieldErrors);
    }

    const { installation_id: installationId, state } = queryResult.data;
    let organizationSlug: string | undefined;
    req.log.info(
      'GitHub setup callback (installationId=%s, organizationSlug=%s)',
      installationId,
      state,
    );

    if (state) {
      const cacheRecord = await config.stateStore.get(state);

      if (cacheRecord?.method !== 'github') {
        return res.status(400).send('Invalid or expired state');
      }

      await withOperation(config, req, res, async injector => {
        await injector.get(GitHubIntegrationManager).register({
          organizationId: cacheRecord.organizationId,
          installationId,
        });
      });
      organizationSlug = (await getOrganization(config, req, res, cacheRecord.organizationId)).slug;
    } else {
      const organization = await withOperation(config, req, res, injector =>
        injector.get(GitHubIntegrationManager).getOrganization({ installation: installationId }),
      );
      organizationSlug = organization?.slug;
    }

    return res.redirect(
      organizationSlug ? `${config.publicUrl}/${organizationSlug}/view/settings` : config.publicUrl,
    );
  });

  server.get('/api/github/connect/:organizationSlug', async (req, res) => {
    if (!config.github) {
      throw new Error('GitHub is not set up.');
    }

    const paramsResult = ConnectParams.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).send(paramsResult.error.flatten().fieldErrors);
    }

    const { organizationSlug } = paramsResult.data;

    const organizationId = await withOperation(config, req, res, async injector => {
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId({ organizationSlug });
      await injector.get(GitHubIntegrationManager).assertCanModify({ organizationId });
      return organizationId;
    });
    const state = await config.stateStore.put({ method: 'github', organizationId });

    const redirectUrl = `${config.publicUrl}/api/github/callback`;
    const githubUrl = new URL(`https://github.com/apps/${config.github.appName}/installations/new`);
    githubUrl.searchParams.set('state', state);
    githubUrl.searchParams.set('redirect_url', redirectUrl);

    return res.redirect(githubUrl.toString());
  });

  server.get('/api/slack/callback', async (req, res) => {
    if (!config.slack) {
      throw new Error('The Slack integration is not enabled.');
    }

    const queryResult = SlackCallbackQuery.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).send(queryResult.error.flatten().fieldErrors);
    }

    const { code, state } = queryResult.data;
    const cacheRecord = await config.stateStore.get(state);
    if (cacheRecord?.method !== 'slack') {
      return res.status(400).send('Invalid or expired state');
    }

    const slackResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: stringify({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
      }),
    }).then(response => response.json());

    const slackResponseResult = SlackOAuthv2AccessResponse.safeParse(slackResponse);

    if (!slackResponseResult.success) {
      return res.status(400).send('Failed to parse the response from Slack API');
    }

    if (!slackResponseResult.data.ok) {
      return res.status(400).send(slackResponseResult.data.error);
    }

    const token = slackResponseResult.data.access_token;

    await withOperation(config, req, res, async injector => {
      await injector.get(SlackIntegrationManager).register({
        organizationId: cacheRecord.organizationId,
        token,
      });
    });

    const organization = await getOrganization(config, req, res, cacheRecord.organizationId);
    return res.redirect(`${config.publicUrl}/${organization.slug}/view/settings`);
  });

  server.get('/api/slack/connect/:organizationSlug', async (req, res) => {
    if (!config.slack) {
      throw new Error('The Slack integration is not enabled.');
    }

    const paramsResult = ConnectParams.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).send(paramsResult.error.flatten().fieldErrors);
    }

    const { organizationSlug } = paramsResult.data;
    const organizationId = await withOperation(config, req, res, async injector => {
      const organizationId = await injector
        .get(IdTranslator)
        .translateOrganizationId({ organizationSlug });
      await injector.get(SlackIntegrationManager).assertCanModify({ organizationId });
      return organizationId;
    });
    const state = await config.stateStore.put({ method: 'slack', organizationId });

    const redirectUrl = `${config.publicUrl}/api/slack/callback`;
    const slackUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackUrl.searchParams.set('scope', 'incoming-webhook,chat:write,chat:write.public,commands');
    slackUrl.searchParams.set('client_id', config.slack.clientId);
    slackUrl.searchParams.set('state', state);
    slackUrl.searchParams.set('redirect_url', redirectUrl);

    return res.redirect(slackUrl.toString());
  });
}

function getOrganization(
  config: IntegrationRoutesConfig,
  req: FastifyRequest,
  reply: FastifyReply,
  organizationId: string,
) {
  return withOperation(config, req, reply, injector =>
    injector.get(OrganizationManager).getOrganization({ organizationId }),
  );
}

async function withOperation<T>(
  config: IntegrationRoutesConfig,
  req: FastifyRequest,
  reply: FastifyReply,
  run: (injector: ReturnType<Registry['createOperationController']>['injector']) => T | Promise<T>,
): Promise<T> {
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
    return await controller.ɵrunWithContext(() => run(controller.injector));
  } finally {
    controller.destroy();
  }
}
