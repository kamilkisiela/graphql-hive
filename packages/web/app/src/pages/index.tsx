import { useEffect } from 'react';
import { useQuery } from 'urql';
import { Meta } from '@/components/ui/meta';
import { QueryError } from '@/components/ui/query-error';
import { HiveLogo } from '@/components/v2/icon';
import { graphql } from '@/gql';
import {
  useLastVisitedOrganizationReader,
  useLastVisitedOrganizationWriter,
} from '@/lib/last-visited-org';
import { useRouter } from '@tanstack/react-router';

const DefaultOrganizationQuery = graphql(`
  query myDefaultOrganization($previouslyVisitedOrganizationId: ID) {
    myDefaultOrganization(previouslyVisitedOrganizationId: $previouslyVisitedOrganizationId) {
      organization {
        id
        cleanId
      }
    }
  }
`);

export function IndexPage() {
  const previouslyVisitedOrganizationId = useLastVisitedOrganizationReader();
  const [query] = useQuery({
    query: DefaultOrganizationQuery,
    variables: {
      previouslyVisitedOrganizationId,
    },
  });
  const router = useRouter();
  const result = query.data?.myDefaultOrganization;

  useLastVisitedOrganizationWriter(result?.organization?.cleanId);
  useEffect(() => {
    if (result === null) {
      // No organization, redirect to create one
      void router.navigate({
        to: '/org/new',
      });
    } else if (result?.organization.cleanId) {
      // Redirect to the organization
      void router.navigate({
        to: '/$organizationId',
        params: { organizationId: result.organization.cleanId },
      });
    } // else, still loading
  }, [router, result]);

  if (query.error) {
    return <QueryError organizationId={result?.organization.cleanId ?? null} error={query.error} />;
  }

  return (
    <>
      <Meta title="Welcome" />
      <div className="flex size-full flex-row items-center justify-center">
        <HiveLogo animated={false} className="size-16 animate-pulse" />
      </div>
    </>
  );
}
