import { ReactElement, ReactNode, useCallback, useState } from 'react';
import NextLink from 'next/link';
import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  SettingsIcon,
  SirenIcon,
  UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  useCommand,
} from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink, Tabs } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { CreateProjectModal } from '@/components/v2/modals';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { ProPlanBilling } from '../organization/billing/ProPlanBillingWarm';
import { RateLimitWarn } from '../organization/billing/RateLimitWarn';

enum TabValue {
  Overview = 'overview',
  Members = 'members',
  Settings = 'settings',
  Policy = 'policy',
  Support = 'support',
  Subscription = 'subscription',
}

const OrganizationLayout_CurrentOrganizationFragment = graphql(`
  fragment OrganizationLayout_CurrentOrganizationFragment on Organization {
    id
    name
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
    }
    ...ProPlanBilling_OrganizationFragment
    ...RateLimitWarn_OrganizationFragment
    ...UserMenu_CurrentOrganizationFragment
  }
`);

const OrganizationLayout_MeFragment = graphql(`
  fragment OrganizationLayout_MeFragment on User {
    id
    ...UserMenu_MeFragment
  }
`);

const OrganizationLayout_OrganizationConnectionFragment = graphql(`
  fragment OrganizationLayout_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      cleanId
      name
    }
    ...UserMenu_OrganizationConnectionFragment
  }
`);

export function OrganizationLayout({
  children,
  value,
  className,
  ...props
}: {
  value?: 'overview' | 'members' | 'settings' | 'subscription' | 'policy' | 'support';
  className?: string;
  me: FragmentType<typeof OrganizationLayout_MeFragment> | null;
  currentOrganization: FragmentType<typeof OrganizationLayout_CurrentOrganizationFragment> | null;
  organizations: FragmentType<typeof OrganizationLayout_OrganizationConnectionFragment> | null;
  children: ReactNode;
}): ReactElement | null {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();
  const cmd = useCommand();
  const [cmdPage, setCmdPage] = useState<'root' | 'projects'>('root');
  const docsUrl = getDocsUrl();

  const currentOrganization = useFragment(
    OrganizationLayout_CurrentOrganizationFragment,
    props.currentOrganization,
  );

  const visitOrganization = useCallback(
    (id: string) => {
      router.visitOrganization({
        organizationId: id,
      });
    },
    [router],
  );

  const goBack = useCallback(() => {
    setCmdPage('root');
  }, [setCmdPage]);

  const goToProjects = useCallback(() => {
    setCmdPage('projects');
  }, [setCmdPage]);

  useOrganizationAccess({
    member: currentOrganization?.me ?? null,
    scope: OrganizationAccessScope.Read,
    redirect: true,
  });

  const meInCurrentOrg = currentOrganization?.me;
  const me = useFragment(OrganizationLayout_MeFragment, props.me);
  const organizationConnection = useFragment(
    OrganizationLayout_OrganizationConnectionFragment,
    props.organizations,
  );
  const organizations = organizationConnection?.nodes;

  return (
    <>
      <CommandDialog open={cmd.isOpen} onOpenChange={cmd.toggle}>
        <CommandInput
          placeholder={cmdPage === 'root' ? 'Type a command or search...' : 'Search projects...'}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {cmdPage === 'projects' ? (
            <>
              <CommandGroup>
                <CommandItem onSelect={goBack}>
                  <ArrowLeftIcon className="mr-2 h-4 w-4" /> Go back
                </CommandItem>
                <CommandItem>project 1</CommandItem>
                <CommandItem>project 2</CommandItem>
                <CommandItem>project 3</CommandItem>
              </CommandGroup>
            </>
          ) : null}

          {cmdPage === 'root' ? (
            <>
              <CommandGroup heading="Projects">
                <CommandItem onSelect={goToProjects}>
                  <ArrowLeftRightIcon className="mr-2 h-4 w-4" /> Search organizations...
                </CommandItem>
                <CommandItem onSelect={toggleModalOpen}>
                  <PlusIcon className="mr-2 h-4 w-4" /> Create new project...
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Pages">
                <CommandItem>
                  <LayoutDashboardIcon className="mr-2 h-4 w-4" /> Go to Overview
                </CommandItem>
                <CommandItem>
                  <UsersIcon className="mr-2 h-4 w-4" /> Go to Members
                </CommandItem>
                <CommandItem>
                  <SirenIcon className="mr-2 h-4 w-4" /> Go to Policy
                </CommandItem>
                <CommandItem>
                  <SettingsIcon className="mr-2 h-4 w-4" /> Go to Settings
                </CommandItem>
                <CommandItem>
                  <CreditCardIcon className="mr-2 h-4 w-4" /> Manage Subscription
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Help">
                <CommandItem
                  onSelect={() => {
                    void router.push('https://cal.com/team/the-guild/graphql-hive-15m');
                  }}
                >
                  <CalendarDaysIcon className="mr-2 h-4 w-4" /> Schedule a meeting
                </CommandItem>
                {docsUrl ? (
                  <CommandItem
                    onSelect={() => {
                      void router.push(docsUrl);
                    }}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" /> Visit documentation
                  </CommandItem>
                ) : null}
                <CommandItem>
                  <LifeBuoyIcon className="mr-2 h-4 w-4" /> Contact support
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
          {/* {currentOrganization && organizations ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Organizations">
                {organizations.map(org => (
                  <CommandItem
                    key={org.cleanId}
                    onSelect={() => {
                      console.log('command clicked');
                      visitOrganization(org.cleanId);
                    }}
                  >
                    {org.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null} */}
        </CommandList>
      </CommandDialog>
      <header>
        <div className="container flex h-[84px] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="w-8 h-8" />
            {currentOrganization && organizations ? (
              <Select defaultValue={currentOrganization.cleanId} onValueChange={visitOrganization}>
                <SelectTrigger variant="default">
                  <div className="font-medium" data-cy="organization-picker-current">
                    {currentOrganization.name}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.cleanId} value={org.cleanId}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-48 h-5 bg-gray-800 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <UserMenu
              me={me ?? null}
              currentOrganization={currentOrganization ?? null}
              organizations={organizationConnection ?? null}
            />
          </div>
        </div>
      </header>
      <div className="relative border-b border-gray-800">
        <div className="container flex justify-between items-center">
          {currentOrganization && meInCurrentOrg ? (
            <Tabs value={value}>
              <Tabs.List>
                <Tabs.Trigger value={TabValue.Overview} asChild>
                  <NextLink
                    href={{
                      pathname: '/[organizationId]',
                      query: { organizationId: currentOrganization.cleanId },
                    }}
                  >
                    Overview
                  </NextLink>
                </Tabs.Trigger>
                {canAccessOrganization(OrganizationAccessScope.Members, meInCurrentOrg) && (
                  <Tabs.Trigger value={TabValue.Members} asChild>
                    <NextLink
                      href={{
                        pathname: '/[organizationId]/view/[tab]',
                        query: {
                          organizationId: currentOrganization.cleanId,
                          tab: TabValue.Members,
                        },
                      }}
                    >
                      Members
                    </NextLink>
                  </Tabs.Trigger>
                )}
                {canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                  <>
                    <Tabs.Trigger value={TabValue.Policy} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: TabValue.Policy,
                          },
                        }}
                      >
                        Policy
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={TabValue.Settings} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: TabValue.Settings,
                          },
                        }}
                      >
                        Settings
                      </NextLink>
                    </Tabs.Trigger>
                  </>
                )}
                {canAccessOrganization(OrganizationAccessScope.Read, meInCurrentOrg) &&
                  env.zendeskSupport && (
                    <Tabs.Trigger value={TabValue.Support} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: TabValue.Support,
                          },
                        }}
                      >
                        Support
                      </NextLink>
                    </Tabs.Trigger>
                  )}
                {getIsStripeEnabled() &&
                  canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                    <Tabs.Trigger value={TabValue.Subscription} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: TabValue.Subscription,
                          },
                        }}
                      >
                        Subscription
                      </NextLink>
                    </Tabs.Trigger>
                  )}
              </Tabs.List>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 px-4 py-3 border-b-[2px] border-b-transparent">
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
              <div className="w-12 h-5 bg-gray-800 rounded-full animate-pulse" />
            </div>
          )}
          {currentOrganization ? (
            <>
              <Button onClick={toggleModalOpen} variant="link" className="text-orange-500">
                <PlusIcon size={16} className="mr-2" />
                New project
              </Button>
              <CreateProjectModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
            </>
          ) : null}
        </div>
      </div>
      <div className="container pb-7">
        {currentOrganization ? (
          <>
            <ProPlanBilling organization={currentOrganization} />
            <RateLimitWarn organization={currentOrganization} />
          </>
        ) : null}
        <div className={className}>{children}</div>
      </div>
    </>
  );
}
