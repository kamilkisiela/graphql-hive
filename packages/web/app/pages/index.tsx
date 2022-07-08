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

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  try {
    let orgId: string | null = null;
    const cookies = new Cookies(req, res);
    const lastOrgIdInCookies = cookies.get(LAST_VISITED_ORG_KEY);

    if (lastOrgIdInCookies) {
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
      }
    }

    if (orgId) {
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

export default function Home(): ReactElement {
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
