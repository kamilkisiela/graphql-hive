import { useEffect } from 'react';
import { useQuery } from 'urql';
import { HiveLogo } from '@/components/ui/icon';
import { Meta } from '@/components/ui/meta';
import { QueryError } from '@/components/ui/query-error';
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
        slug
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

  useLastVisitedOrganizationWriter(result?.organization?.slug);
  useEffect(() => {
    if (result === null) {
      // No organization, redirect to create one
      void router.navigate({
        to: '/org/new',
      });
    } else if (result?.organization.slug) {
      // Redirect to the organization
      void router.navigate({
        to: '/$organizationSlug',
        params: { organizationSlug: result.organization.slug },
      });
    } // else, still loading
  }, [router, result]);

  if (query.error) {
    return <QueryError organizationSlug={result?.organization.slug ?? null} error={query.error} />;
  }

  return (
    <>
      <Meta title="Welcome" />
      <div className="flex size-full h-[100vh] flex-row items-center justify-center">
        <HiveLogo animated={false} className="size-16 animate-pulse" />
      </div>
    </>
  );
}
