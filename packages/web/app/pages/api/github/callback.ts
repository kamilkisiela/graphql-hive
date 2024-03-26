import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';
import { graphql } from '@/lib/api/utils';

export async function ensureGithubIntegration(
  req: NextApiRequest,
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

export default async function githubCallback(req: NextApiRequest, res: NextApiResponse) {
  const installationId = req.query.installation_id as string;
  const orgId = req.query.state as string;

  await ensureGithubIntegration(req, {
    installationId,
    orgId,
  });
  res.redirect(`/${orgId}/view/settings`);
}
