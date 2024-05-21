import { ReactElement, ReactNode } from 'react';
import { useQuery } from 'urql';
import { EditIcon, PlusIcon, TrashIcon, UserPlusMinusIcon } from '@/components/v2/icon';
import { DocumentType, graphql, useFragment } from '@/gql';
import { Link } from './link';
import { Subtitle, Title } from './page';
import { TimeAgo } from './time-ago';

const Activities_OrganizationActivitiesQuery = graphql(`
  query Activities_OrganizationActivitiesQuery($selector: OrganizationActivitiesSelector!) {
    organizationActivities(selector: $selector) {
      nodes {
        __typename
        id
        createdAt
        ... on OrganizationPlanChangeActivity {
          id
          createdAt
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
          newPlan
          previousPlan
        }
        ... on OrganizationCreatedActivity {
          id
          createdAt
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on OrganizationNameUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on OrganizationIdUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on MemberAddedActivity {
          id
          createdAt
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on MemberDeletedActivity {
          id
          createdAt
          email
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on MemberLeftActivity {
          id
          createdAt
          email
          organization {
            ...Activities_OrganizationFragment
          }
        }
        ... on ProjectCreatedActivity {
          id
          createdAt
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on ProjectDeletedActivity {
          id
          createdAt
          name
          cleanId
          organization {
            ...Activities_OrganizationFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on ProjectNameUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on ProjectIdUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on TargetCreatedActivity {
          id
          createdAt
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          target {
            ...Activities_TargetFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on TargetDeletedActivity {
          id
          createdAt
          name
          cleanId
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on TargetNameUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          target {
            ...Activities_TargetFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
        ... on TargetIdUpdatedActivity {
          id
          createdAt
          value
          organization {
            ...Activities_OrganizationFragment
          }
          project {
            ...Activities_ProjectFragment
          }
          target {
            ...Activities_TargetFragment
          }
          user {
            ...Activities_UserFragment
          }
        }
      }
      total
    }
  }
`);

const Activities_UserFragment = graphql(`
  fragment Activities_UserFragment on User {
    id
    email
    fullName
    displayName
    provider
    isAdmin
  }
`);

const Activities_OrganizationFragment = graphql(`
  fragment Activities_OrganizationFragment on Organization {
    id
    cleanId
    name
  }
`);

const Activities_ProjectFragment = graphql(`
  fragment Activities_ProjectFragment on Project {
    id
    cleanId
    name
  }
`);

const Activities_TargetFragment = graphql(`
  fragment Activities_TargetFragment on Target {
    id
    cleanId
    name
  }
`);

type ActivityNode = DocumentType<
  typeof Activities_OrganizationActivitiesQuery
>['organizationActivities']['nodes'][number];

export const getActivity = (
  activity: ActivityNode,
): {
  icon: ReactElement;
  content: ReactElement | string;
} => {
  const { __typename: type } = activity;
  const organization = useFragment(
    Activities_OrganizationFragment,
    'organization' in activity ? activity.organization : null,
  );
  const project = useFragment(
    Activities_ProjectFragment,
    'project' in activity && !!activity.project ? activity.project : null,
  );
  const target = useFragment(
    Activities_TargetFragment,
    'target' in activity && !!activity.target ? activity.target : null,
  );
  const user = useFragment(
    Activities_UserFragment,
    'user' in activity && activity.user ? activity.user : null,
  );

  const userDisplayName = user?.displayName || '';

  const projectLink =
    project && organization ? (
      <Link
        variant="primary"
        to="/$organizationId/$projectId"
        params={{
          organizationId: organization.cleanId,
          projectId: project.cleanId,
        }}
      >
        {project.name}
      </Link>
    ) : null;

  const targetLink =
    target && project && organization ? (
      <Link
        variant="primary"
        to="/$organizationId/$projectId/$targetId"
        params={{
          organizationId: organization.cleanId,
          projectId: project.cleanId,
          targetId: target.cleanId,
        }}
      >
        {target.name}
      </Link>
    ) : null;

  switch (type) {
    /* Organization */
    case 'OrganizationCreatedActivity':
      return {
        content: `${userDisplayName} created the organization`,
        icon: <PlusIcon className="size-4" />,
      };
    case 'OrganizationNameUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed organization name to{' '}
            <b className="text-gray-300">{activity.value}</b>
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    case 'OrganizationIdUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed organization id to{' '}
            <b className="text-gray-300">{activity.value}</b>
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    case 'OrganizationPlanChangeActivity':
      return {
        content: (
          <>
            {userDisplayName} changed organization plan to{' '}
            <b className="text-gray-300">{activity.newPlan}</b>
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    case 'MemberAddedActivity':
      return {
        content: `${userDisplayName} joined the organization`,
        icon: <UserPlusMinusIcon isPlus className="size-5" />,
      };
    case 'MemberDeletedActivity':
      return {
        content: (
          <>
            {userDisplayName} removed <b className="text-gray-300">{activity.email}</b> from
            organization
          </>
        ),
        icon: <UserPlusMinusIcon isPlus={false} className="size-5" />,
      };
    case 'MemberLeftActivity':
      return {
        content: (
          <>
            <b className="text-gray-300">{activity.email}</b> left organization
          </>
        ),
        icon: <UserPlusMinusIcon isPlus={false} className="size-5" />,
      };
    /* Project */
    case 'ProjectCreatedActivity':
      return {
        content: (
          <>
            {userDisplayName} created {projectLink} project
          </>
        ),
        icon: <PlusIcon className="size-4" />,
      };
    case 'ProjectDeletedActivity':
      return {
        content: (
          <>
            {userDisplayName} removed <b className="text-gray-300">{activity.name}</b> project
          </>
        ),
        icon: <TrashIcon className="size-5" />,
      };
    case 'ProjectNameUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed {projectLink} name
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    case 'ProjectIdUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed project id to{' '}
            <b className="text-gray-300">{activity.value}</b>
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    /* Target */
    case 'TargetCreatedActivity':
      return {
        content: (
          <>
            {userDisplayName} created {targetLink} target in {projectLink} project
          </>
        ),
        icon: <PlusIcon className="size-4" />,
      };
    case 'TargetDeletedActivity':
      return {
        content: (
          <>
            {userDisplayName} removed <b className="text-gray-300">{activity.name}</b> target from{' '}
            {projectLink} project
          </>
        ),
        icon: <TrashIcon className="size-5" />,
      };
    case 'TargetNameUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed{' '}
            {organization && project && target ? (
              <Link
                variant="primary"
                to="/$organizationId/$projectId/$targetId"
                params={{
                  organizationId: organization.cleanId,
                  projectId: project.cleanId,
                  targetId: target.cleanId,
                }}
              >
                {activity.value}
              </Link>
            ) : (
              activity.value
            )}{' '}
            target name in {projectLink} project
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    case 'TargetIdUpdatedActivity':
      return {
        content: (
          <>
            {userDisplayName} changed target id to <b className="text-gray-300">{activity.value}</b>
          </>
        ),
        icon: <EditIcon className="size-3.5" />,
      };
    default:
      // @ts-expect-error -- empty object to omit throwing if new event was added without updating this fn
      return {};
  }
};

export const Activities = (props: { organizationId: string }): ReactElement => {
  const [organizationActivitiesQuery] = useQuery({
    query: Activities_OrganizationActivitiesQuery,
    variables: {
      selector: {
        organization: props.organizationId,
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
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-24 animate-pulse rounded-full bg-gray-800" />
                    <div className="h-2 w-8 animate-pulse rounded-full bg-gray-800" />
                  </div>
                  <div>
                    <div className="mt-4 h-3 w-32 animate-pulse rounded-full bg-gray-800" />
                  </div>
                </div>
              </ActivityContainer>
            ))
          : activities.nodes.map(activity => {
              const { content } = getActivity(activity);
              const project = useFragment(
                Activities_ProjectFragment,
                'project' in activity && !!activity.project ? activity.project : null,
              );
              const target = useFragment(
                Activities_TargetFragment,
                'target' in activity && !!activity.target ? activity.target : null,
              );

              return (
                <ActivityContainer key={activity.id}>
                  <>
                    <div className="grow">
                      {project ? (
                        <div className="flex items-center justify-between">
                          <h3 className="mb-1 flex items-center font-medium">
                            <span className="line-clamp-1">{project.name}</span>
                            {target ? (
                              <>
                                <span className="mx-2 italic">/</span>
                                <span className="line-clamp-1">{target.name}</span>
                              </>
                            ) : null}
                          </h3>
                          <TimeAgo date={activity.createdAt} className="float-right text-xs" />
                        </div>
                      ) : null}
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
    cursor-default
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
