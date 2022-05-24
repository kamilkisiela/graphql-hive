import React from 'react';
import { useQuery } from 'urql';
import { TargetActivitiesDocument } from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { Activities } from '@/components/common/activities';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Section } from '../common';

const targetActivitiesDocument = fixDuplicatedFragments(TargetActivitiesDocument);

export const TargetActivities: React.FC = () => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: targetActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
        limit: 10,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  return (
    <div>
      <Section.Title>Recent Activity</Section.Title>
      <Activities fetching={query.fetching} activities={query.data?.targetActivities.nodes} />
    </div>
  );
};
