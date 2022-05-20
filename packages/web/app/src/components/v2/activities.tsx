import { ReactElement } from 'react';
import NextLink from 'next/link';
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
  ProjectDeletedActivity,
} from '@/graphql';
import { fixDuplicatedFragments } from '@/lib/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const organizationActivitiesDocument = fixDuplicatedFragments(
  OrganizationActivitiesDocument
);

export const getActivity = (
  activity: ActivityNode
): {
  icon: ReactElement;
  content: ReactElement | string;
} => {
  const { __typename: type } = activity;
  const organization = (activity as any).organization;
  const user = (activity as any).user;
  const projectLink = 'project' in activity && (
    <NextLink
      href={{
        pathname: '/[orgId]/[projectId]',
        query: {
          orgId: organization.cleanId,
          projectId: activity.project.cleanId,
        },
      }}
      passHref
    >
      <Link variant="primary">{activity.project.name}</Link>
    </NextLink>
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
    <NextLink href={targetHref} passHref>
      <Link variant="primary">{activity.target.name}</Link>
    </NextLink>
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
            <b className="text-gray-300">
              {(activity as OrganizationNameUpdatedActivity).value}
            </b>
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'OrganizationIdUpdatedActivity':
      return {
        content: (
          <>
            {user.displayName} changed organization id to{' '}
            <b className="text-gray-300">
              {(activity as OrganizationIdUpdatedActivity).value}
            </b>
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
            <b className="text-gray-300">
              {(activity as MemberDeletedActivity).email}
            </b>{' '}
            from organization
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
            <b className="text-gray-300">
              {(activity as ProjectDeletedActivity).name}
            </b>{' '}
            project
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
        content: '',
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    /* Target */
    case 'TargetCreatedActivity':
      return {
        content: (
          <>
            {user.displayName} created {targetLink} target in {projectLink}{' '}
            project
          </>
        ),
        icon: <PlusIcon className="h-4 w-4" />,
      };
    case 'TargetDeletedActivity':
      return {
        content: (
          <>
            {user.displayName} removed{' '}
            <b className="text-gray-300">{activity.name}</b> target from{' '}
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
            <NextLink href={targetHref} passHref>
              <Link variant="primary">{activity.value}</Link>
            </NextLink>{' '}
            target name in {projectLink} project
          </>
        ),
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    case 'TargetIdUpdatedActivity':
      return {
        content: '',
        icon: <EditIcon className="h-3.5 w-3.5" />,
      };
    default:
      // @ts-expect-error -- empty object to omit throwing if new event was added without updating this fn
      return {};
  }
};

export const Activities = (props): ReactElement => {
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
      {(!activities || activities.total !== 0) && (
        <ul className="mt-4 w-full break-all rounded-md border border-gray-800 p-5">
          {(activities
            ? activities.nodes
            : Array.from({ length: 3 }, (_, id) => ({ id }))
          ).map((activity) => {
            const { content, icon } = getActivity(activity);

            return (
              <li
                key={activity.id}
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
                {isLoading ? (
                  <>
                    <Skeleton circle visible className="h-7 w-7 shrink-0" />
                    <div className="grow">
                      <Skeleton visible className="mb-2 h-3 w-2/5" />
                      <Skeleton visible className="h-3 w-full" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="self-center p-1">{icon}</div>
                    <div className="grow">
                      {'project' in activity && (
                        <h3 className="mb-1 flex items-center font-medium">
                          <span className="line-clamp-1">
                            {activity.project.name}
                          </span>
                          {'target' in activity && (
                            <>
                              <ArrowDownIcon className="h-4 w-4 shrink-0 -rotate-90 select-none" />
                              <span className="line-clamp-1">
                                {activity.target.name}
                              </span>
                            </>
                          )}
                        </h3>
                      )}
                      <div>
                        <span className="text-sm text-[#c4c4c4]">
                          {content}
                        </span>
                        &nbsp;
                        <TimeAgo
                          date={activity.createdAt}
                          className="float-right text-xs"
                        />
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
