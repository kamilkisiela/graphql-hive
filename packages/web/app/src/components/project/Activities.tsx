import React from 'react';
import { useQuery } from 'urql';
import { ProjectActivitiesDocument } from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { Activities } from '@/components/common/activities';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Section } from '../common';

const projectActivitiesDocument = fixDuplicatedFragments(
  ProjectActivitiesDocument
);

export const ProjectActivities: React.FC = () => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: projectActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        limit: 10,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  return (
    <div>
      <Section.Title>Recent Activity</Section.Title>
      <Activities
        fetching={query.fetching}
        activities={query.data?.projectActivities.nodes}
      />
    </div>
  );
};
