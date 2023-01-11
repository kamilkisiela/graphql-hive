import React, { ReactElement, ReactNode } from 'react';
import { useQuery } from 'urql';
import { ActivityNode } from '@/components/common/activities/common';
import { Heading, Link, Skeleton, TimeAgo } from '@/components/v2';
import {
  ArrowDownIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  UserPlusMinusIcon,
} from '@/components/v2/icon';
import {
  MemberDeletedActivity,
  OrganizationActivitiesDocument,
  OrganizationIdUpdatedActivity,
  OrganizationNameUpdatedActivity,
  OrganizationPlanChangeActivity,
  ProjectDeletedActivity,
  ProjectIdUpdatedActivity,
} from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useRouteSelector } from '@/lib/hooks';

const organizationActivitiesDocument = fixDuplicatedFragments(OrganizationActivitiesDocument);

export const getActivity = (
  activity: ActivityNode,
): {
  icon: ReactElement;
  content: ReactElement | string;
} => {
  const { __typename: type } = activity;
  const organization = (activity as any).organization;
  const user = (activity as any).user;
  const projectLink = 'project' in activity && (
    <Link
      variant="primary"
      href={{
        pathname: '/[orgId]/[projectId]',
        query: {
          orgId: organization.cleanId,
          projectId: activity.project.cleanId,
        },
      }}
    >
      {activity.project.name}
    </Link>
  );

  const targetHref = 'target' in activity && {
    pathname: '/[orgId]/[projectId]/[targetId]',
    query: {
      orgId: organization.cleanId,
      projectId: activity.project.cleanId,
      targetId: activity.target.cleanId,
    },
  };

  const targetLink = 'target' in activity && (
    /* TODO: figure out what is going on with targetHref... */
    <Link variant="primary" href={targetHref as any}>
      {activity.target.name}
    </Link>
  );

  switch (type) {
    /* Organization */
    case 'OrganizationCreatedActivity':
      return {
        content: `${user.displayName} created the organization`,
        icon: <PlusIcon className="h-4 w-4" />,
      };
    case 'OrganizationNameUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed organization name to{' '}
            <b className="text-gray-300">{(activity as OrganizationNameUpdatedActivity).value}</b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'OrganizationIdUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed organization id to{' '}
            <b className="text-gray-300">{(activity as OrganizationIdUpdatedActivity).value}</b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'OrganizationPlanChangeActivity':
      return {
        content: (
          <>
            {user.displayName} changed organization plan to{' '}
            <b className="text-gray-300">{(activity as OrganizationPlanChangeActivity).newPlan}</b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'MemberAddedActivity':
      return {
        content: `${user.displayName} joined the organization`,
        icon: <UserPlusMinusIcon isPlus className="h-5 w-5" />,
      };
    case 'MemberDeletedActivity':
      return {
        content: (
          <>
            {user.displayName} removed{' '}
            <b className="text-gray-300">{(activity as MemberDeletedActivity).email}</b> from
            organization
          </>
        ),
        icon: <UserPlusMinusIcon isPlus={false} className="h-5 w-5" />,
      };
    /* Project */
    case 'ProjectCreatedActivity':
      return {
        content: (
          <>
            {user.displayName} created {projectLink} project
          </>
        ),
        icon: <PlusIcon className="h-4 w-4" />,
      };
    case 'ProjectDeletedActivity':
      return {
        content: (
          <>
            {user.displayName} removed{' '}
            <b className="text-gray-300">{(activity as ProjectDeletedActivity).name}</b> project
          </>
        ),
        icon: <TrashIcon className="h-5 w-5" />,
      };
    case 'ProjectNameUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed {projectLink} name
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'ProjectIdUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed project id to{' '}
            <b className="text-gray-300">{(activity as ProjectIdUpdatedActivity).value}</b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    /* Target */
    case 'TargetCreatedActivity':
      return {
        content: (
          <>
            {user.displayName} created {targetLink} target in {projectLink} project
          </>
        ),
        icon: <PlusIcon className="h-4 w-4" />,
      };
    case 'TargetDeletedActivity':
      return {
        content: (
          <>
            {user.displayName} removed <b className="text-gray-300">{activity.name}</b> target from{' '}
            {projectLink} project
          </>
        ),
        icon: <TrashIcon className="h-5 w-5" />,
      };
    case 'TargetNameUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed {/* TODO: figure out what is going on with targetHref... */}
            <Link variant="primary" href={targetHref as any}>
              {activity.value}
            </Link>{' '}
            target name in {projectLink} project
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'TargetIdUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed target id to{' '}
            <b className="text-gray-300">{activity.value}</b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    default:
      // @ts-expect-error -- empty object to omit throwing if new event was added without updating this fn
      return {};
  }
};

export const Activities = (props: React.ComponentProps<'div'>): ReactElement => {
  const router = useRouteSelector();
  const [organizationActivitiesQuery] = useQuery({
    query: organizationActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        limit: 10,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const activities = organizationActivitiesQuery.data?.organizationActivities;
  const isLoading = organizationActivitiesQuery.fetching;

  return (
    <div className="w-[450px] shrink-0" {...props}>
      <Heading>Recent Activity</Heading>
      <ul className="mt-4 w-full break-all rounded-md border border-gray-800 p-5">
        {isLoading || !activities?.nodes
          ? new Array(3).fill(null).map((_, index) => (
              <ActivityContainer key={index}>
                <Skeleton circle visible className="h-7 w-7 shrink-0" />
                <div className="grow">
                  <Skeleton visible className="mb-2 h-3 w-2/5" />
                  <Skeleton visible className="h-3 w-full" />
                </div>
              </ActivityContainer>
            ))
          : activities.nodes.map(activity => {
              const { content, icon } = getActivity(activity);

              return (
                <ActivityContainer key={activity.id}>
                  <>
                    <div className="self-center p-1">{icon}</div>
                    <div className="grow">
                      {'project' in activity && (
                        <h3 className="mb-1 flex items-center font-medium">
                          <span className="line-clamp-1">{activity.project.name}</span>
                          {'target' in activity && (
                            <>
                              <ArrowDownIcon className="h-4 w-4 shrink-0 -rotate-90 select-none" />
                              <span className="line-clamp-1">{activity.target.name}</span>
                            </>
                          )}
                        </h3>
                      )}
                      <div>
                        <span className="text-sm text-[#c4c4c4]">{content}</span>
                        &nbsp;
                        <TimeAgo date={activity.createdAt} className="float-right text-xs" />
                      </div>
                    </div>
                  </>
                </ActivityContainer>
              );
            })}
      </ul>
    </div>
  );
};

const ActivityContainer = (props: { children: ReactNode }) => (
  <li
    className="
    flex
    items-center
    gap-2.5
    border-b
    border-gray-800
    py-5
    text-xs
    text-gray-500
    first:pt-0
    last:border-b-0
    last:pb-0
    first-of-type:mt-0
  "
  >
    {props.children}
  </li>
);
