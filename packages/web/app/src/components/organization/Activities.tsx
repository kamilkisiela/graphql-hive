import React from 'react';
import { useQuery } from 'urql';
import { OrganizationActivitiesDocument } from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { Activities } from '@/components/common/activities';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Section } from '../common';

const organizationActivitiesDocument = fixDuplicatedFragments(OrganizationActivitiesDocument);

export const OrganizationActivities: React.FC = () => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: organizationActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        limit: 10,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  return (
    <div>
      <Section.Title>Recent Activity</Section.Title>
      <Activities fetching={query.fetching} activities={query.data?.organizationActivities.nodes} />
    </div>
  );
};
