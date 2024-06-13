import { ReactElement, ReactNode } from 'react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { CreateProjectModal } from '@/components/ui/modal/create-project';
import { UserMenu } from '@/components/ui/user-menu';
import { HiveLink } from '@/components/v2/hive-link';
import { PlusIcon } from '@/components/v2/icon';
import { Tabs } from '@/components/v2/tabs';
import { env } from '@/env/frontend';
import { graphql, useFragment } from '@/gql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { Link } from '@tanstack/react-router';
import { ProPlanBilling } from '../organization/billing/ProPlanBillingWarm';
import { RateLimitWarn } from '../organization/billing/RateLimitWarn';
import { QueryError } from '../ui/query-error';
import { OrganizationSelector } from './organization-selectors';

export enum Page {
  Overview = 'overview',
  Members = 'members',
  Settings = 'settings',
  Policy = 'policy',
  Support = 'support',
  Subscription = 'subscription',
}

const OrganizationLayout_OrganizationFragment = graphql(`
  fragment OrganizationLayout_OrganizationFragment on Organization {
    id
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
    }
    ...ProPlanBilling_OrganizationFragment
    ...RateLimitWarn_OrganizationFragment
  }
`);

const OrganizationLayoutQuery = graphql(`
  query OrganizationLayoutQuery {
    me {
      id
      ...UserMenu_MeFragment
    }
    organizations {
      ...OrganizationSelector_OrganizationConnectionFragment
      ...UserMenu_OrganizationConnectionFragment
      nodes {
        ...OrganizationLayout_OrganizationFragment
      }
    }
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
  organizationId: string;
  children: ReactNode;
}): ReactElement | null {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: OrganizationLayoutQuery,
    requestPolicy: 'cache-first',
  });

  const organizations = useFragment(
    OrganizationLayout_OrganizationFragment,
    query.data?.organizations.nodes,
  );
  const currentOrganization = organizations?.find(org => org.cleanId === props.organizationId);

  useOrganizationAccess({
    member: currentOrganization?.me ?? null,
    scope: OrganizationAccessScope.Read,
    redirect: true,
    organizationId: props.organizationId,
  });

  useLastVisitedOrganizationWriter(currentOrganization?.cleanId);

  const meInCurrentOrg = currentOrganization?.me;

  if (query.error) {
    return <QueryError error={query.error} organizationId={props.organizationId} />;
  }

  return (
    <>
      <header>
        <div className="container flex h-[--header-height] items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <HiveLink className="size-8" />
            <OrganizationSelector
              currentOrganizationCleanId={props.organizationId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
          <div>
            <UserMenu
              me={query.data?.me ?? null}
              currentOrganizationCleanId={props.organizationId}
              organizations={query.data?.organizations ?? null}
            />
          </div>
        </div>
      </header>
      <div className="relative h-[--tabs-navbar-height] border-b border-gray-800">
        <div className="container flex items-center justify-between">
          {currentOrganization && meInCurrentOrg ? (
            <Tabs value={page}>
              <Tabs.List>
                <Tabs.Trigger value={Page.Overview} asChild>
                  <Link
                    to="/$organizationId"
                    params={{ organizationId: currentOrganization.cleanId }}
                  >
                    Overview
                  </Link>
                </Tabs.Trigger>
                {canAccessOrganization(OrganizationAccessScope.Members, meInCurrentOrg) && (
                  <Tabs.Trigger value={Page.Members} asChild>
                    <Link
                      to="/$organizationId/view/members"
                      params={{ organizationId: currentOrganization.cleanId }}
                      search={{ page: 'list' }}
                    >
                      Members
                    </Link>
                  </Tabs.Trigger>
                )}
                {canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                  <>
                    <Tabs.Trigger value={Page.Policy} asChild>
                      <Link
                        to="/$organizationId/view/policy"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Policy
                      </Link>
                    </Tabs.Trigger>
                    <Tabs.Trigger value={Page.Settings} asChild>
                      <Link
                        to="/$organizationId/view/settings"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Settings
                      </Link>
                    </Tabs.Trigger>
                  </>
                )}
                {canAccessOrganization(OrganizationAccessScope.Read, meInCurrentOrg) &&
                  env.zendeskSupport && (
                    <Tabs.Trigger value={Page.Support} asChild>
                      <Link
                        to="/$organizationId/view/support"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Support
                      </Link>
                    </Tabs.Trigger>
                  )}
                {getIsStripeEnabled() &&
                  canAccessOrganization(OrganizationAccessScope.Settings, meInCurrentOrg) && (
                    <Tabs.Trigger value={Page.Subscription} asChild>
                      <Link
                        to="/$organizationId/view/subscription"
                        params={{ organizationId: currentOrganization.cleanId }}
                      >
                        Subscription
                      </Link>
                    </Tabs.Trigger>
                  )}
              </Tabs.List>
            </Tabs>
          ) : (
            <div className="flex flex-row gap-x-8 border-b-2 border-b-transparent px-4 py-3">
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
              <CreateProjectModal
                organizationId={props.organizationId}
                isOpen={isModalOpen}
                toggleModalOpen={toggleModalOpen}
              />
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
