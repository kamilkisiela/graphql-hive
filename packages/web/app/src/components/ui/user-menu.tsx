import NextLink from 'next/link';
import { LifeBuoyIcon } from 'lucide-react';
import { FaGithub, FaGoogle, FaKey, FaUsersSlash } from 'react-icons/fa';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/v2';
import {
  AlertTriangleIcon,
  CalendarIcon,
  FileTextIcon,
  GraphQLIcon,
  GridIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  TrendingUpIcon,
} from '@/components/v2/icon';
import { LeaveOrganizationModal } from '@/components/v2/modals/leave-organization';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import { AuthProvider } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useToggle } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { GetStartedProgress } from '../get-started/wizard';
import { MemberRoleMigrationStickyNote } from '../organization/members/migration';
import { UserSettingsModal } from '../user/settings';
import { Changelog } from './changelog/changelog';
import { latestChangelogs } from './changelog/generated-changelogs';

export const UserMenu_CurrentOrganizationFragment = graphql(`
  fragment UserMenu_CurrentOrganizationFragment on Organization {
    id
    cleanId
    name
    getStarted {
      ...GetStartedWizard_GetStartedProgress
    }
    me {
      ...UserMenu_MemberFragment
    }
    ...MemberRoleMigrationStickyNote_OrganizationFragment
  }
`);

export const UserMenu_OrganizationConnectionFragment = graphql(`
  fragment UserMenu_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      cleanId
      name
    }
  }
`);

export const UserMenu_MeFragment = graphql(`
  fragment UserMenu_MeFragment on User {
    id
    email
    fullName
    displayName
    provider
    isAdmin
    canSwitchOrganization
  }
`);

const UserMenu_MemberFragment = graphql(`
  fragment UserMenu_MemberFragment on Member {
    canLeaveOrganization
  }
`);

export function UserMenu(props: {
  me: FragmentType<typeof UserMenu_MeFragment> | null;
  currentOrganization: FragmentType<typeof UserMenu_CurrentOrganizationFragment> | null;
  organizations: FragmentType<typeof UserMenu_OrganizationConnectionFragment> | null;
}) {
  const docsUrl = getDocsUrl();
  const me = useFragment(UserMenu_MeFragment, props.me);
  const currentOrganization = useFragment(
    UserMenu_CurrentOrganizationFragment,
    props.currentOrganization,
  );
  const meInOrg = useFragment(UserMenu_MemberFragment, currentOrganization?.me);
  const organizations = useFragment(UserMenu_OrganizationConnectionFragment, props.organizations);
  const [isUserSettingsModalOpen, toggleUserSettingsModalOpen] = useToggle();
  const [isLeaveOrganizationModalOpen, toggleLeaveOrganizationModalOpen] = useToggle();

  const canLeaveOrganization = !!currentOrganization && meInOrg?.canLeaveOrganization === true;

  return (
    <>
      <UserSettingsModal
        toggleModalOpen={toggleUserSettingsModalOpen}
        isOpen={isUserSettingsModalOpen}
      />
      {canLeaveOrganization ? (
        <LeaveOrganizationModal
          toggleModalOpen={toggleLeaveOrganizationModalOpen}
          isOpen={isLeaveOrganizationModalOpen}
          organizationId={currentOrganization.cleanId}
          organizationName={currentOrganization.name}
        />
      ) : null}
      <div className="flex flex-row items-center gap-8">
        <Changelog changes={latestChangelogs} />
        <MemberRoleMigrationStickyNote organization={currentOrganization} />
        {currentOrganization ? <GetStartedProgress tasks={currentOrganization.getStarted} /> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn('cursor-pointer', currentOrganization ? '' : 'animate-pulse')}
              data-cy="user-menu-trigger"
            >
              <Avatar shape="circle" className="border-2 border-orange-900/50" />
            </div>
          </DropdownMenuTrigger>

          {me && organizations ? (
            <DropdownMenuContent sideOffset={5} align="end" className="min-w-[240px]">
              <DropdownMenuLabel>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col space-y-1">
                    <div className="truncate text-sm font-medium leading-none">
                      {me?.displayName}
                    </div>
                    <div className="text-muted-foreground truncate text-xs font-normal leading-none">
                      {me?.email}
                    </div>
                  </div>
                  <div>
                    {me?.provider === AuthProvider.Google ? (
                      <FaGoogle title="Signed in using Google" />
                    ) : me?.provider === AuthProvider.Github ? (
                      <FaGithub title="Signed in using Github" />
                    ) : (
                      <FaKey title="Signed in using username and password" />
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                {me?.canSwitchOrganization ? (
                  <DropdownMenuSubTrigger>
                    <GridIcon className="mr-2 size-4" />
                    Switch organization
                  </DropdownMenuSubTrigger>
                ) : null}
                <DropdownMenuSubContent className="max-w-[300px]">
                  {organizations.nodes.length ? (
                    <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  ) : null}
                  <DropdownMenuSeparator />
                  {organizations.nodes.map(org => (
                    <NextLink
                      href={{
                        pathname: '/[organizationId]',
                        query: { organizationId: org.cleanId },
                      }}
                      key={org.cleanId}
                    >
                      <DropdownMenuItem active={currentOrganization?.cleanId === org.cleanId}>
                        {org.name}
                      </DropdownMenuItem>
                    </NextLink>
                  ))}
                  <DropdownMenuSeparator />
                  <NextLink href="/org/new">
                    <DropdownMenuItem>
                      Create organization
                      <PlusIcon className="ml-2 size-4" />
                    </DropdownMenuItem>
                  </NextLink>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem asChild>
                <a
                  href="https://cal.com/team/the-guild/graphql-hive-15m"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarIcon className="mr-2 size-4" />
                  Schedule a meeting
                </a>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  toggleUserSettingsModalOpen();
                }}
              >
                <SettingsIcon className="mr-2 size-4" />
                Profile settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={docsUrl} target="_blank" rel="noreferrer">
                  <FileTextIcon className="mr-2 size-4" />
                  Documentation
                </a>
              </DropdownMenuItem>
              {currentOrganization && env.zendeskSupport ? (
                <NextLink
                  href={{
                    pathname: '/[organizationId]/view/support',
                    query: { organizationId: currentOrganization.cleanId },
                  }}
                >
                  <DropdownMenuItem>
                    <LifeBuoyIcon className="mr-2 size-4" />
                    Support
                  </DropdownMenuItem>
                </NextLink>
              ) : null}
              <DropdownMenuItem asChild>
                <a href="https://status.graphql-hive.com" target="_blank" rel="noreferrer">
                  <AlertTriangleIcon className="mr-2 size-4" />
                  Status page
                </a>
              </DropdownMenuItem>
              {me.isAdmin === true && (
                <NextLink href="/manage">
                  <DropdownMenuItem>
                    <TrendingUpIcon className="mr-2 size-4" />
                    Manage Instance
                  </DropdownMenuItem>
                </NextLink>
              )}
              {env.nodeEnv === 'development' && (
                <NextLink href="/dev">
                  <DropdownMenuItem>
                    <GraphQLIcon className="mr-2 size-4" />
                    Dev GraphiQL
                  </DropdownMenuItem>
                </NextLink>
              )}
              <DropdownMenuSeparator />
              {canLeaveOrganization ? (
                <DropdownMenuItem
                  onClick={() => {
                    toggleLeaveOrganizationModalOpen();
                  }}
                >
                  <FaUsersSlash className="mr-2 size-4" />
                  Leave organization
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <a href="/logout" data-cy="user-menu-logout">
                  <LogOutIcon className="mr-2 size-4" />
                  Log out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          ) : null}
        </DropdownMenu>
      </div>
    </>
  );
}
