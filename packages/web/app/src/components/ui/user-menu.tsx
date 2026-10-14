import { useState } from 'react';
import cookies from 'js-cookie';
import {
  CalendarIcon,
  FileTextIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserRoundMinus,
} from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { useThemeMenuEntry } from '@/components/theme/theme-switcher';
import { Avatar } from '@/components/ui/primitives/avatar/avatar';
import { Menu } from '@/components/ui/primitives/floating/menu/menu';
import { AlertDialog } from '@/components/ui/primitives/overlays/alert-dialog/alert-dialog';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { env } from '@/env/frontend';
import { graphql, useFragment } from '@/gql';
import { getDocsUrl } from '@/lib/docs-url';
import { useToggle, useViewer } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Link, useParams } from '@tanstack/react-router';
import { GetStartedProgress } from '../get-started/trigger';
import { UserSettingsModal } from '../user/settings';
import { Changelog } from './changelog/changelog';
import { latestChangelog } from './changelog/generated-changelog';

const UserMenu_OrganizationConnectionFragment = graphql(`
  fragment UserMenu_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
    }
  }
`);

const UserMenu_OrganizationFragment = graphql(`
  fragment UserMenu_OrganizationFragment on Organization {
    id
    slug
    me {
      id
      canLeaveOrganization
    }
    getStarted {
      ...GetStartedWizard_GetStartedProgress
    }
  }
`);

// The same fields the layouts select, so a cache hit after the first paint.
const UserMenu_OrganizationQuery = graphql(`
  query UserMenu_OrganizationQuery($organizationSlug: String!) {
    organizationBySlug(organizationSlug: $organizationSlug) {
      id
      ...UserMenu_OrganizationFragment
    }
  }
`);

const UserMenu_MeFragment = graphql(`
  fragment UserMenu_MeFragment on User {
    id
    email
    displayName
    provider
    isAdmin
    canSwitchOrganization
    provisionInfo {
      __typename
    }
  }
`);

export function UserMenu({ withOrganization = true }: { withOrganization?: boolean }) {
  const docsUrl = getDocsUrl();
  const viewer = useViewer();
  const me = useFragment(UserMenu_MeFragment, viewer.data?.me ?? null);
  const organizations = useFragment(
    UserMenu_OrganizationConnectionFragment,
    viewer.data?.organizations ?? null,
  )?.nodes;
  const { organizationSlug } = useParams({ strict: false });
  const [organizationQuery] = useQuery({
    query: UserMenu_OrganizationQuery,
    variables: { organizationSlug: organizationSlug ?? '' },
    pause: !organizationSlug || !withOrganization,
  });
  const currentOrganization = useFragment(
    UserMenu_OrganizationFragment,
    organizationQuery.data?.organizationBySlug ?? null,
  );
  const themeEntry = useThemeMenuEntry();
  const [isUserSettingsModalOpen, toggleUserSettingsModalOpen] = useToggle();
  const [userSettingsSession, setUserSettingsSession] = useState(0);
  const [isLeaveOrganizationModalOpen, toggleLeaveOrganizationModalOpen] = useToggle();

  return (
    <>
      <UserSettingsModal
        key={userSettingsSession}
        toggleModalOpen={toggleUserSettingsModalOpen}
        isOpen={isUserSettingsModalOpen}
        onOpenChangeComplete={open => {
          if (!open) {
            setUserSettingsSession(s => s + 1);
          }
        }}
      />
      {currentOrganization?.me?.canLeaveOrganization ? (
        <LeaveOrganizationModal
          toggleModalOpen={toggleLeaveOrganizationModalOpen}
          isOpen={isLeaveOrganizationModalOpen}
          organizationSlug={currentOrganization.slug}
        />
      ) : null}
      <div className="flex flex-row items-center gap-8">
        <Changelog changes={latestChangelog} />
        {currentOrganization ? (
          <GetStartedProgress className="hidden md:block" tasks={currentOrganization.getStarted} />
        ) : null}
        <Menu
          align="end"
          sideOffset={5}
          minWidth="md"
          trigger={
            <button
              type="button"
              className={cn('cursor-pointer', currentOrganization ? '' : 'animate-pulse')}
              data-cy="user-menu-trigger"
            >
              <Avatar variant="outlined" alt={me?.displayName} />
            </button>
          }
          sections={
            me && organizations
              ? [
                  [{ kind: 'header', title: me.displayName, subtitle: me.email }],
                  [
                    me.canSwitchOrganization && {
                      kind: 'submenu',
                      label: 'Switch organization',
                      icon: LayoutGridIcon,
                      maxWidth: 'default',
                      items: [
                        organizations.length
                          ? {
                              label: 'Organizations',
                              items: organizations.map(org => ({
                                label: org.slug,
                                selected: currentOrganization?.slug === org.slug,
                                render: (
                                  <Link
                                    to="/$organizationSlug"
                                    params={{ organizationSlug: org.slug }}
                                  />
                                ),
                              })),
                            }
                          : [],
                        [
                          {
                            label: 'Create organization',
                            trailingIcon: PlusIcon,
                            render: <Link to="/org/new" />,
                          },
                        ],
                      ],
                    },
                    {
                      kind: 'link',
                      label: 'Schedule a meeting',
                      icon: CalendarIcon,
                      external: true,
                      href: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3KSfa5HXLUJKSoxdziqD_2rWPlDevQgWHeSNGEUN5GqafDw7ezvWlvKYjmxOo5_0hcB4_8W8G2',
                    },
                    !me.provisionInfo && {
                      label: 'Profile settings',
                      icon: SettingsIcon,
                      onClick: toggleUserSettingsModalOpen,
                    },
                  ],
                  [themeEntry],
                  [
                    {
                      kind: 'link',
                      label: 'Documentation',
                      icon: FileTextIcon,
                      href: docsUrl,
                      external: true,
                    },
                    currentOrganization &&
                      env.zendeskSupport && {
                        label: 'Support',
                        icon: LifeBuoyIcon,
                        render: (
                          <Link
                            to="/$organizationSlug/view/support"
                            params={{ organizationSlug: currentOrganization.slug }}
                          />
                        ),
                      },
                    {
                      kind: 'link',
                      label: 'Status page',
                      icon: TriangleAlertIcon,
                      href: 'https://status.graphql-hive.com',
                      external: true,
                    },
                    me.isAdmin && {
                      label: 'Manage Instance',
                      icon: TrendingUpIcon,
                      render: <Link to="/manage" />,
                    },
                  ],
                  [
                    currentOrganization?.me?.canLeaveOrganization && {
                      label: 'Leave organization',
                      icon: UserRoundMinus,
                      onClick: toggleLeaveOrganizationModalOpen,
                    },
                    {
                      kind: 'link',
                      label: 'Log out',
                      icon: LogOutIcon,
                      href: '/logout',
                      attrs: { 'data-cy': 'user-menu-logout' },
                    },
                  ],
                ]
              : []
          }
        />
      </div>
    </>
  );
}

const LeaveOrganizationModal_LeaveOrganizationMutation = graphql(`
  mutation LeaveOrganizationModal_LeaveOrganizationMutation($input: OrganizationSelectorInput!) {
    leaveOrganization(input: $input) {
      ok {
        organizationId
      }
      error {
        message
      }
    }
  }
`);

export function LeaveOrganizationModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
}) {
  const { organizationSlug } = props;
  const [mutationState, mutate] = useMutation(LeaveOrganizationModal_LeaveOrganizationMutation);
  const { toast } = useToast();

  async function onSubmit() {
    const result = await mutate({
      input: {
        organizationSlug,
      },
    });

    if (result.error) {
      toast({
        variant: 'destructive',
        title: "Couldn't leave organization. Please try again.",
        description: result.error.message,
      });
    }

    if (result.data?.leaveOrganization.error) {
      toast({
        variant: 'destructive',
        title: "Couldn't leave organization.",
        description: result.data.leaveOrganization.error.message,
      });
    }

    if (result.data?.leaveOrganization.ok) {
      props.toggleModalOpen();
      cookies.remove(LAST_VISITED_ORG_KEY);
      window.location.href = '/';
    }
  }

  return (
    <LeaveOrganizationModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      organizationSlug={organizationSlug}
      onSubmit={onSubmit}
      isSubmitting={mutationState.fetching}
    />
  );
}

export function LeaveOrganizationModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  return (
    <AlertDialog
      open={props.isOpen}
      onOpenChange={open => {
        if (!open && !props.isSubmitting) {
          props.toggleModalOpen();
        }
      }}
      title={`Leave ${props.organizationSlug}?`}
      description={
        <>
          Are you sure you want to leave this organization? You will lose access to{' '}
          <span className="font-semibold text-fg">{props.organizationSlug}</span>.{' '}
          <span className="font-semibold text-fg">This action is irreversible!</span>
        </>
      }
      confirm={{
        label: 'Leave organization',
        variant: 'destructive',
        disabled: props.isSubmitting,
        onClick: props.onSubmit,
      }}
      cancel={{ disabled: props.isSubmitting }}
    />
  );
}
