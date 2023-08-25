import { ReactElement, ReactNode } from 'react';
import { useQuery } from 'urql';
import { ActivityNode } from '@/components/common/activities/common';
import { Link, TimeAgo } from '@/components/v2';
import { EditIcon, PlusIcon, TrashIcon, UserPlusMinusIcon } from '@/components/v2/icon';
import {
  MemberDeletedActivity,
  MemberLeftActivity,
  OrganizationActivitiesDocument,
  OrganizationIdUpdatedActivity,
  OrganizationNameUpdatedActivity,
  OrganizationPlanChangeActivity,
  ProjectDeletedActivity,
  ProjectIdUpdatedActivity,
} from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useRouteSelector } from '@/lib/hooks';
import { Subtitle, Title } from '../ui/page';

const organizationActivitiesDocument = fixDuplicatedFragments(OrganizationActivitiesDocument);

export const getActivity = (
  activity: ActivityNode,
): {
  icon: ReactElement;
  content: ReactElement | string;
} => {
  const { __typename: type } = activity;
  const { organization, user } = activity as any;
  const projectLink = 'project' in activity && !!activity.project && (
    <Link
      variant="primary"
      href={{
        pathname: '/[organizationId]/[projectId]',
        query: {
          organizationId: organization.cleanId,
          projectId: activity.project.cleanId,
        },
      }}
    >
      {activity.project.name}
    </Link>
  );

  const targetHref =
    'target' in activity && !!activity.target
      ? {
          pathname: '/[organizationId]/[projectId]/[targetId]',
          query: {
            organizationId: organization.cleanId,
            projectId: activity.project.cleanId,
            targetId: activity.target.cleanId,
          },
        }
      : '#';

  const targetLink = 'target' in activity && !!activity.target && (
    <Link variant="primary" href={targetHref}>
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
    case 'MemberLeftActivity':
      return {
        content: (
          <>
            <b className="text-gray-300">{(activity as MemberLeftActivity).email}</b> left{' '}
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
            {user.displayName} changed{' '}
            <Link variant="primary" href={targetHref}>
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

export const Activities = (): ReactElement => {
  const router = useRouteSelector();
  const [organizationActivitiesQuery] = useQuery({
    query: organizationActivitiesDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        limit: 5,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  const activities = organizationActivitiesQuery.data?.organizationActivities;
  const isLoading = organizationActivitiesQuery.fetching;

  return (
    <div className="w-[450px] shrink-0">
      <div className="py-6">
        <Title>Activity</Title>
        <Subtitle>Recent changes in your organization</Subtitle>
      </div>
      <ul className="w-full break-all">
        {isLoading || !activities?.nodes
          ? new Array(3).fill(null).map((_, index) => (
              <ActivityContainer key={index}>
                <div className="grow">
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-2 bg-gray-800 rounded-full animate-pulse" />
                    <div className="w-8 h-2 bg-gray-800 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <div className="w-32 h-3 mt-4 bg-gray-800 rounded-full animate-pulse" />
                  </div>
                </div>
              </ActivityContainer>
            ))
          : activities.nodes.map(activity => {
              const { content } = getActivity(activity);

              return (
                <ActivityContainer key={activity.id}>
                  <>
                    <div className="grow">
                      {'project' in activity && !!activity.project && (
                        <div className="flex justify-between items-center">
                          <h3 className="mb-1 flex items-center font-medium">
                            <span className="line-clamp-1">{activity.project.name}</span>
                            {'target' in activity && !!activity.target && (
                              <>
                                <span className="italic mx-2">/</span>
                                <span className="line-clamp-1">{activity.target.name}</span>
                              </>
                            )}
                          </h3>
                          <TimeAgo date={activity.createdAt} className="float-right text-xs" />
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-[#c4c4c4]">{content}</span>
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
    cursor-default
  "
  >
    {props.children}
  </li>
);
