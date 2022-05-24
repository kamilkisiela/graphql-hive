import { NextApiRequest, NextApiResponse } from 'next';
import { graphql } from '@/lib/api/utils';

export async function ensureGithubIntegration(
  req: NextApiRequest,
  input: {
    installationId: string;
    orgId: string;
  }
) {
  const { orgId, installationId } = input;
  await graphql({
    url: `${process.env.APP_BASE_URL.replace(/\/$/, '')}/api/proxy`,
    headers: {
      ...req.headers,
      'content-type': 'application/json',
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
        installationId: installationId,
      },
    },
  });
}

export default async function githubCallback(req: NextApiRequest, res: NextApiResponse) {
  console.log('GitHub Integration Callback');
  const installationId = req.query.installation_id as string;
  const orgId = req.query.state as string;

  await ensureGithubIntegration(req, {
    installationId,
    orgId,
  });
  res.redirect(`/${orgId}/settings`);
}
