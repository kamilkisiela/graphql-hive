import { useEffect, ReactElement } from 'react';
import { useQuery } from 'urql';
import { OrganizationsDocument, OrganizationType } from '@/graphql';
import { Title } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import Cookies from 'cookies';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { authenticated } from '@/components/authenticated-container';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import type { InternalApi } from '@hive/server';
import { env } from '@/env/backend';
import { NextApiRequest, NextApiResponse } from 'next';
import Session from 'supertokens-node/recipe/session';
import { writeLastVisitedOrganization } from '@/lib/cookies';

async function getSuperTokensUserIdFromRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> {
  const session = await Session.getSession(req, res, { sessionRequired: false });
  return session?.getUserId() ?? null;
}

export const getServerSideProps = withSessionProtection(async ({ req, res }) => {
  const internalApi = createTRPCProxyClient<InternalApi>({
    links: [
      httpLink({
        url: `${env.serverEndpoint}/trpc`,
      }),
    ],
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
    }
  } catch (error) {
    console.error(error);
  }

  return {
    props: {},
  };
});

function Home(): ReactElement {
  const [query] = useQuery({ query: OrganizationsDocument });
  const router = useRouteSelector();

  useEffect(() => {
    // Just in case server-side redirect wasn't working
    if (query.data) {
      const org = query.data.organizations.nodes.find(
        node => node.type === OrganizationType.Personal,
      );
      if (org) {
        router.visitOrganization({ organizationId: org.cleanId });
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
