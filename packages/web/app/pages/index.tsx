import { useEffect, ReactElement } from 'react';
import { GetServerSideProps } from 'next';
import { useQuery } from 'urql';
import { print, stripIgnoredCharacters, ExecutionResult } from 'graphql';
import { OrganizationsDocument, OrganizationsQuery, OrganizationType } from '@/graphql';
import { Title } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import Cookies from 'cookies';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { authenticated } from '@/components/authenticated-container';
import { createHash } from 'node:crypto';

function hash(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function readLastVisitedOrganization(cookies: Cookies, token: string | undefined): string | undefined {
  const data = cookies.get(LAST_VISITED_ORG_KEY);

  // Seems like the cookie is not set or it's in the legacy format (before we started hashing the access token)
  if (data?.includes(':') && token) {
    const [orgId, checksum] = data.split(':');

    if (checksum === hash(token)) {
      return orgId;
    }
  }
}

function writeLastVisitedOrganization(cookies: Cookies, token: string, orgId: string): void {
  cookies.set(LAST_VISITED_ORG_KEY, `${orgId}:${hash(token)}`, {
    httpOnly: false,
  });
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  try {
    let orgId: string | null = null;
    const cookies = new Cookies(req, res);

    // Check whether user is authenticated.
    const sAccessToken = cookies.get('sAccessToken');
    const isAuthenticated = !!sAccessToken;

    const lastOrgIdInCookies = readLastVisitedOrganization(cookies, sAccessToken);

    if (lastOrgIdInCookies) {
      console.log('Use last visited org', lastOrgIdInCookies);
      orgId = lastOrgIdInCookies;
    } else {
      const { host, cookie } = req.headers;
      const protocol = host?.startsWith('localhost') ? 'http' : 'https';
      const query = stripIgnoredCharacters(print(OrganizationsDocument));

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        Accept: 'application/json',
      };

      if (cookie != null) {
        headers['cookie'] = cookie;
      }

      const response = await fetch(`${protocol}://${host}/api/proxy`, {
        method: 'POST',
        body: JSON.stringify({ query, operationName: 'organizations' }),
        headers,
      });

      const result: ExecutionResult<OrganizationsQuery> = await response.json();
      const org = result.data?.organizations?.nodes?.find(node => node.type === OrganizationType.Personal);

      if (org) {
        orgId = org.cleanId;

        if (sAccessToken) {
          writeLastVisitedOrganization(cookies, sAccessToken, orgId);
        }
      }
    }

    if (isAuthenticated && orgId) {
      return {
        redirect: {
          destination: `/${orgId}`,
          permanent: false,
        },
      };
    }
  } catch (error) {
    console.error(error);
  }

  return {
    props: {},
  };
};

function Home(): ReactElement {
  const [query] = useQuery({ query: OrganizationsDocument });
  const router = useRouteSelector();

  useEffect(() => {
    // Just in case server-side redirect wasn't working
    if (query.data) {
      const org = query.data.organizations.nodes.find(node => node.type === OrganizationType.Personal);
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
