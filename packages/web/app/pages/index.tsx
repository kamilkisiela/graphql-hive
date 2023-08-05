import { ReactElement, useEffect } from 'react';
import { NextApiRequest, NextApiResponse } from 'next';
import Cookies from 'cookies';
import Session from 'supertokens-node/recipe/session';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Title } from '@/components/common';
import { DataWrapper } from '@/components/v2';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { env } from '@/env/backend';
import { graphql } from '@/gql';
import { writeLastVisitedOrganization } from '@/lib/cookies';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { getLogger } from '@/server-logger';
// eslint-disable-next-line import/no-extraneous-dependencies -- TODO: should we move to "dependencies"?
import { type InternalApi } from '@hive/server';
import { createTRPCProxyClient, httpLink } from '@trpc/client';

async function getSuperTokensUserIdFromRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await Session.getSession(req, res, { sessionRequired: false });
  return session?.getUserId() ?? null;
}

export const getServerSideProps = withSessionProtection(async ({ req, res }) => {
  const logger = getLogger(req);
  const internalApi = createTRPCProxyClient<InternalApi>({
    links: [httpLink({ url: `${env.serverEndpoint}/trpc` })],
  });

  const superTokensId = await getSuperTokensUserIdFromRequest(req as any, res as any);
  try {
    const cookies = new Cookies(req, res);
    const lastOrgIdInCookies = cookies.get(LAST_VISITED_ORG_KEY) ?? null;

    if (superTokensId) {
      const defaultOrganization = await internalApi.getDefaultOrgForUser.query({
        superTokensUserId: superTokensId,
        lastOrgId: lastOrgIdInCookies,
      });

      if (defaultOrganization) {
        writeLastVisitedOrganization(req, res, defaultOrganization.cleanId);

        return {
          redirect: {
            destination: `/${defaultOrganization.cleanId}`,
            permanent: false,
          },
        };
      }

      return {
        redirect: {
          destination: '/org/new',
          permanent: true,
        },
      };
    }
  } catch (error) {
    logger.error(error);
  }

  return {
    props: {},
  };
});

export const OrganizationsQuery = graphql(`
  query organizations {
    organizations {
      nodes {
        ...OrganizationFields
        cleanId
      }
      total
    }
  }
`);

function Home(): ReactElement {
  const [query] = useQuery({ query: OrganizationsQuery });
  const router = useRouteSelector();

  useEffect(() => {
    // Just in case server-side redirect wasn't working
    if (query.data) {
      const org = query.data.organizations.nodes[0];

      if (org) {
        void router.visitOrganization({ organizationId: org.cleanId });
      }
    }
  }, [router, query.data]);

  return (
    <>
      <Title title="Home" />
      <DataWrapper query={query}>{() => <></>}</DataWrapper>
    </>
  );
}

export default authenticated(Home);
