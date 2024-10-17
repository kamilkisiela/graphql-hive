import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '@/env/backend';
import { graphql } from './utils';

const CallbackQuery = z.object({
  installation_id: z.string({
    required_error: 'Invalid installation_id',
  }),
  state: z.string({
    required_error: 'Invalid state',
  }),
});

const SetupCallbackQuery = z.object({
  installation_id: z.string({
    required_error: 'Invalid installation_id',
  }),
  state: z
    .string({
      required_error: 'Invalid state',
    })
    .optional(),
});

const ConnectParams = z.object({
  organizationId: z.string({
    required_error: 'Invalid organizationId',
  }),
});

export function connectGithub(server: FastifyInstance) {
  server.get('/api/github/callback', async (req, res) => {
    const queryResult = CallbackQuery.safeParse(req.query);

    if (!queryResult.success) {
      void res.status(400).send(queryResult.error.flatten().fieldErrors);
      return;
    }

    const { installation_id: installationId, state: orgId } = queryResult.data;

    // const installationId = req.query.installation_id as string;
    // const orgId = req.query.state as string;

    await ensureGithubIntegration(req, {
      installationId,
      orgId,
    });
    void res.redirect(`/${orgId}/view/settings`);
  });

  server.get('/api/github/setup-callback', async (req, res) => {
    const queryResult = SetupCallbackQuery.safeParse(req.query);

    if (!queryResult.success) {
      void res.status(400).send(queryResult.error.flatten().fieldErrors);
      return;
    }

    let { installation_id: installationId, state: orgId } = queryResult.data;

    req.log.info('GitHub setup callback (installationId=%s, orgId=%s)', installationId, orgId);

    if (orgId) {
      await ensureGithubIntegration(req, {
        installationId,
        orgId,
      });
    } else {
      const result = await graphql<{
        organizationByGitHubInstallationId?: {
          slug: string;
        };
      }>({
        url: env.graphqlPublicEndpoint,
        headers: {
          ...req.headers,
          'content-type': 'application/json',
          'graphql-client-name': 'Hive App',
          'graphql-client-version': env.release,
        },
        operationName: 'getOrganizationByGitHubInstallationId',
        query: /* GraphQL */ `
          query getOrganizationByGitHubInstallationId($installation: ID!) {
            organizationByGitHubInstallationId(input: $input) {
              id
              slug
            }
          }
        `,
        variables: {
          installation: installationId,
        },
      });

      orgId = result.data?.organizationByGitHubInstallationId?.slug;
    }

    if (orgId) {
      void res.redirect(`/${orgId}/view/settings`);
    } else {
      void res.redirect('/');
    }
  });

  server.get('/api/github/connect/:organizationId', async (req, res) => {
    if (!env.github) {
      req.log.error('GitHub is not set up.');
      throw new Error('GitHub is not set up.');
    }

    const paramsResult = ConnectParams.safeParse(req.params);

    if (!paramsResult.success) {
      void res.status(400).send(paramsResult.error.flatten().fieldErrors);
      return;
    }

    const { organizationId } = paramsResult.data;

    req.log.info('Connect to GitHub (orgId=%s)', organizationId);

    const url = `https://github.com/apps/${env.github.appName}/installations/new`;

    const redirectUrl = `${env.appBaseUrl}/api/github/callback`;

    void res.redirect(`${url}?state=${organizationId}&redirect_url=${redirectUrl}`);
  });
}

async function ensureGithubIntegration(
  req: FastifyRequest,
  input: {
    installationId: string;
    orgId: string;
  },
) {
  const { orgId, installationId } = input;
  await graphql({
    url: env.graphqlPublicEndpoint,
    headers: {
      ...req.headers,
      'content-type': 'application/json',
      'graphql-client-name': 'Hive App',
      'graphql-client-version': env.release,
    },
    operationName: 'addGitHubIntegration',
    query: /* GraphQL */ `
      mutation addGitHubIntegration($input: AddGitHubIntegrationInput!) {
        addGitHubIntegration(input: $input)
      }
    `,
    variables: {
      input: {
        organization: orgId,
        installationId,
      },
    },
  });
}
