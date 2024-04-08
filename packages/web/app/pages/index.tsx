import { ReactElement, useEffect } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Title } from '@/components/common';
import { QueryError } from '@/components/ui/query-error';
import { HiveLogo } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import {
  useLastVisitedOrganizationReader,
  useLastVisitedOrganizationWriter,
} from '@/lib/last-visited-org';

export const DefaultOrganizationQuery = graphql(`
  query myDefaultOrganization($previouslyVisitedOrganizationId: ID) {
    myDefaultOrganization(previouslyVisitedOrganizationId: $previouslyVisitedOrganizationId) {
      organization {
        id
        cleanId
      }
    }
  }
`);

function Home(): ReactElement {
  const previouslyVisitedOrganizationId = useLastVisitedOrganizationReader();
  const [query] = useQuery({
    query: DefaultOrganizationQuery,
    variables: {
      previouslyVisitedOrganizationId,
    },
  });
  const router = useRouteSelector();
  const result = query.data?.myDefaultOrganization;
  useLastVisitedOrganizationWriter(result?.organization?.cleanId);

  useEffect(() => {
    if (result === null) {
      // No organization, redirect to create one
      void router.push('/org/new');
    } else if (result?.organization.cleanId) {
      // Redirect to the organization
      void router.visitOrganization({ organizationId: result.organization.cleanId });
    } // else, still loading
  }, [router, result]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <>
      <Title title="Home" />
      <div className="flex size-full flex-row items-center justify-center">
        <HiveLogo className="size-16 animate-pulse" />
      </div>
    </>
  );
}

export default authenticated(Home);
