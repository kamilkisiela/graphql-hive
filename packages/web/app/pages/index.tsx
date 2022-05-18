import * as React from 'react';
import { GetServerSideProps } from 'next';
import { useQuery } from 'urql';
import { print, stripIgnoredCharacters, ExecutionResult } from 'graphql';
import {
  OrganizationsDocument,
  OrganizationsQuery,
  OrganizationType,
} from '@/graphql';
import { Title } from '@/components/common';
import { useNavigation } from '@/components/common/Navigation';
import { DataWrapper } from '@/components/common/DataWrapper';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  try {
    const host = ctx.req.headers.host;
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const url = `${protocol}://${host}`;
    const query = stripIgnoredCharacters(print(OrganizationsDocument));

    const response = await fetch(url + '/api/proxy', {
      method: 'POST',
      body: JSON.stringify({
        query,
        operationName: 'organizations',
        variables: {},
      }),
      headers: {
        cookie: ctx.req.headers.cookie,
        'content-type': 'application/json',
        Accept: 'application/json',
      },
    });

    const result: ExecutionResult<OrganizationsQuery> = await response.json();
    const org = result.data?.organizations?.nodes?.find(
      (node) => node.type === OrganizationType.Personal
    );

    if (org) {
      return {
        redirect: {
          destination: `/${org.cleanId}`,
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

export default function Home() {
  const { setNavigation } = useNavigation();
  const [query] = useQuery({
    query: OrganizationsDocument,
  });
  const router = useRouteSelector();

  React.useEffect(() => {
    setNavigation({});
  }, []);

  React.useEffect(() => {
    // Just in case server-side redirect wasn't working
    if (query.data) {
      const org = query.data.organizations.nodes.find(
        (node) => node.type === OrganizationType.Personal
      );

      router.visitOrganization({ organizationId: org.cleanId });
    }
  }, [router, query.data]);

  return (
    <>
      <Title title="Home" />
      <DataWrapper query={query}>{() => <></>}</DataWrapper>
    </>
  );
}
