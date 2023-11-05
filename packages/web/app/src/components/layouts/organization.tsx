import { ReactElement, ReactNode } from 'react';
import NextLink from 'next/link';
import { Button } from '@/components/ui/button';
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
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { ProPlanBilling } from '../organization/billing/ProPlanBillingWarm';
import { RateLimitWarn } from '../organization/billing/RateLimitWarn';

export enum Page {
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
  page,
  className,
  ...props
}: {
  page?: Page;
  className?: string;
  me: FragmentType<typeof OrganizationLayout_MeFragment> | null;
  currentOrganization: FragmentType<typeof OrganizationLayout_CurrentOrganizationFragment> | null;
  organizations: FragmentType<typeof OrganizationLayout_OrganizationConnectionFragment> | null;
  children: ReactNode;
}): ReactElement | null {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const currentOrganization = useFragment(
    OrganizationLayout_CurrentOrganizationFragment,
    props.currentOrganization,
  );

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
      <header>
        <div className="container flex h-[84px] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="h-8 w-8" />
            {currentOrganization && organizations ? (
              <Select
                defaultValue={currentOrganization.cleanId}
                onValueChange={id => {
                  router.visitOrganization({
                    organizationId: id,
                  });
                }}
              >
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
              <div className="h-5 w-48 animate-pulse rounded-full bg-gray-800" />
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
        <div className="container flex items-center justify-between">
          {currentOrganization && meInCurrentOrg ? (
            <Tabs value={page}>
              <Tabs.List>
                <Tabs.Trigger value={Page.Overview} asChild>
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
                  <Tabs.Trigger value={Page.Members} asChild>
                    <NextLink
                      href={{
                        pathname: '/[organizationId]/view/[tab]',
                        query: {
                          organizationId: currentOrganization.cleanId,
                          tab: Page.Members,
                        },
                      }}
                    >
                      Members
                    </NextLink>
                  </Tabs.Trigger>
                )}
                {canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                  <>
                    <Tabs.Trigger value={Page.Policy} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: Page.Policy,
                          },
                        }}
                      >
                        Policy
                      </NextLink>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Settings} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: Page.Settings,
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
                    <Tabs.Trigger value={Page.Support} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: Page.Support,
                          },
                        }}
                      >
                        Support
                      </NextLink>
                    </Tabs.Trigger>
                  )}
                {getIsStripeEnabled() &&
                  canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                    <Tabs.Trigger value={Page.Subscription} asChild>
                      <NextLink
                        href={{
                          pathname: '/[organizationId]/view/[tab]',
                          query: {
                            organizationId: currentOrganization.cleanId,
                            tab: Page.Subscription,
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
            <div className="flex flex-row gap-x-8 border-b-[2px] border-b-transparent px-4 py-3">
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-800" />
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
