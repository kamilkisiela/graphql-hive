import { NextApiRequest, NextApiResponse } from 'next';
import { env } from '@/env/backend';
import { graphql } from '@/lib/api/utils';
import { getLogger } from '@/server-logger';
import { ensureGithubIntegration } from './callback';

export default async function githubSetupCallback(req: NextApiRequest, res: NextApiResponse) {
  const logger = getLogger(req);
  const installationId = req.query.installation_id as string;
  let orgId = req.query.state as string | undefined;

  logger.info('GitHub setup callback (installationId=%s, orgId=%s)', installationId, orgId);

  if (orgId) {
    await ensureGithubIntegration(req, {
      installationId,
      orgId,
    });
  } else {
    const result = await graphql<{
      organizationByGitHubInstallationId?: {
        cleanId: string;
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
            cleanId
          }
        }
      `,
      variables: {
        installation: installationId,
      },
    });

    orgId = result.data?.organizationByGitHubInstallationId?.cleanId;
  }

  if (orgId) {
    res.redirect(`/${orgId}/view/settings`);
  } else {
    res.redirect('/');
  }
}
