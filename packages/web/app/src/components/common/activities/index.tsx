import * as React from 'react';
import 'twin.macro';
import { Skeleton, useColorModeValue } from '@chakra-ui/react';
import {
  OrganizationCreatedActivity,
  OrganizationNameUpdatedActivity,
  OrganizationIdUpdatedActivity,
  MemberAddedActivity,
  MemberDeletedActivity,
  ProjectCreatedActivity,
  ProjectDeletedActivity,
  ProjectNameUpdatedActivity,
  ProjectIdUpdatedActivity,
  TargetCreatedActivity,
  TargetDeletedActivity,
  TargetNameUpdatedActivity,
  TargetIdUpdatedActivity,
  OrganizationPlanChangeActivity,
} from '@/graphql';
import { ActivityProps, ActivityNode } from './common';
import { OrganizationCreated } from './OrganizationCreated';
import { OrganizationNameUpdated } from './OrganizationNameUpdated';
import { OrganizationIdUpdated } from './OrganizationIdUpdated';
import { MemberAdded } from './MemberAdded';
import { MemberDeleted } from './MemberDeleted';
import { ProjectCreated } from './ProjectCreated';
import { ProjectDeleted } from './ProjectDeleted';
import { ProjectNameUpdated } from './ProjectNameUpdated';
import { ProjectIdUpdated } from './ProjectIdUpdated';
import { TargetCreated } from './TargetCreated';
import { TargetDeleted } from './TargetDeleted';
import { TargetNameUpdated } from './TargetNameUpdated';
import { TargetIdUpdated } from './TargetIdUpdated';
import { OrganizationPlanChange } from './OrganizationPlanChange';

const ActivityRow: React.FC<ActivityProps> = ({ activity }) => {
  switch (activity.__typename) {
    /* Organization */
    case 'OrganizationCreatedActivity':
      return (
        <OrganizationCreated
          activity={activity as OrganizationCreatedActivity}
        />
      );
    case 'OrganizationPlanChangeActivity':
      return (
        <OrganizationPlanChange
          activity={activity as OrganizationPlanChangeActivity}
        />
      );
    case 'OrganizationNameUpdatedActivity':
      return (
        <OrganizationNameUpdated
          activity={activity as OrganizationNameUpdatedActivity}
        />
      );
    case 'OrganizationIdUpdatedActivity':
      return (
        <OrganizationIdUpdated
          activity={activity as OrganizationIdUpdatedActivity}
        />
      );
    case 'MemberAddedActivity':
      return <MemberAdded activity={activity as MemberAddedActivity} />;
    case 'MemberDeletedActivity':
      return <MemberDeleted activity={activity as MemberDeletedActivity} />;
    /* Project */
    case 'ProjectCreatedActivity':
      return <ProjectCreated activity={activity as ProjectCreatedActivity} />;
    case 'ProjectDeletedActivity':
      return <ProjectDeleted activity={activity as ProjectDeletedActivity} />;
    case 'ProjectNameUpdatedActivity':
      return (
        <ProjectNameUpdated activity={activity as ProjectNameUpdatedActivity} />
      );
    case 'ProjectIdUpdatedActivity':
      return (
        <ProjectIdUpdated activity={activity as ProjectIdUpdatedActivity} />
      );
    /* Target */
    case 'TargetCreatedActivity':
      return <TargetCreated activity={activity as TargetCreatedActivity} />;
    case 'TargetDeletedActivity':
      return <TargetDeleted activity={activity as TargetDeletedActivity} />;
    case 'TargetNameUpdatedActivity':
      return (
        <TargetNameUpdated activity={activity as TargetNameUpdatedActivity} />
      );
    case 'TargetIdUpdatedActivity':
      return <TargetIdUpdated activity={activity as TargetIdUpdatedActivity} />;
    default:
      return null;
  }
};

export const Activities: React.FC<{
  fetching: boolean;
  activities?: ActivityNode[];
}> = ({ activities, fetching }) => {
  const startColor = useColorModeValue('gray.50', 'gray.600');
  const endColor = useColorModeValue('gray.200', 'gray.800');

  return (
    <div tw="pt-3 grid grid-cols-1 divide-y divide-gray-100 dark:divide-gray-500">
      {fetching ? (
        <>
          <div tw="py-3">
            <Skeleton
              startColor={startColor}
              endColor={endColor}
              height="36px"
            />
          </div>
          <div tw="py-3">
            <Skeleton
              startColor={startColor}
              endColor={endColor}
              height="36px"
            />
          </div>
          <div tw="py-3">
            <Skeleton
              startColor={startColor}
              endColor={endColor}
              height="36px"
            />
          </div>
        </>
      ) : (
        activities.map((node) => <ActivityRow key={node.id} activity={node} />)
      )}
    </div>
  );
};
