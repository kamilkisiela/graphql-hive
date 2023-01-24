import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import cookies from 'js-cookie';
import { useQuery } from 'urql';
import { Button, Heading, SubHeader, Tabs } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { CreateProjectModal } from '@/components/v2/modals';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import {
  OrganizationDocument,
  OrganizationFieldsFragment,
  OrganizationType,
  OrgBillingInfoFieldsFragment,
  OrgRateLimitFieldsFragment,
} from '@/graphql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useRouteSelector, useToggle } from '@/lib/hooks';

enum TabValue {
  Overview = 'overview',
  Members = 'members',
  Settings = 'settings',
  Subscription = 'subscription',
}

type OrganizationLayout<T, P> = {
  children(props: { organization: OrganizationFieldsFragment & T }): ReactNode;
  value?: 'overview' | 'members' | 'settings' | 'subscription';
  className?: string;
} & P;

export function OrganizationLayout(
  props: OrganizationLayout<OrgBillingInfoFieldsFragment, { includeBilling: true }>,
): ReactElement;
export function OrganizationLayout(
  props: OrganizationLayout<OrgRateLimitFieldsFragment, { includeRateLimit: true }>,
): ReactElement;
export function OrganizationLayout(
  props: OrganizationLayout<
    OrgBillingInfoFieldsFragment & OrgRateLimitFieldsFragment,
    { includeBilling: true; includeRateLimit: true }
  >,
): ReactElement;
export function OrganizationLayout(props: OrganizationLayout<{}, {}>): ReactElement;
export function OrganizationLayout({
  children,
  value,
  className,
  includeBilling,
  includeRateLimit,
}: OrganizationLayout<
  {},
  {
    includeBilling?: boolean;
    includeRateLimit?: boolean;
  }
>): ReactElement | null {
  const router = useRouteSelector();
  const { push } = useRouter();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const orgId = router.organizationId;

  const [organizationQuery] = useQuery({
    query: OrganizationDocument,
    variables: {
      selector: {
        organization: orgId,
      },
      includeBilling: includeBilling ?? false,
      includeRateLimit: includeRateLimit ?? false,
    },
  });

  useEffect(() => {
    if (organizationQuery.error) {
      cookies.remove(LAST_VISITED_ORG_KEY);
      // url with # provoke error Maximum update depth exceeded
      void push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [organizationQuery.error, router]);

  useOrganizationAccess({
    member: organizationQuery.data?.organization?.organization?.me,
    scope: OrganizationAccessScope.Read,
    redirect: true,
  });

  if (organizationQuery.fetching || organizationQuery.error) {
    return null;
  }

  const organization = organizationQuery.data?.organization?.organization;
  const me = organization?.me;
  const isRegularOrg = !organization || organization.type === OrganizationType.Regular;

  if (!organization || !me) {
    return null;
  }

  if (!value) {
    return <>{children({ organization })}</>;
  }

  return (
    <>
      <SubHeader>
        <div className="container flex h-[84px] items-center justify-between">
          <div>
            <Heading size="2xl" className="line-clamp-1">
              {organization?.name}
            </Heading>
            <div className="text-xs font-medium text-gray-500">Organization</div>
          </div>
          <Button size="large" variant="primary" className="shrink-0" onClick={toggleModalOpen}>
            Create Project
            <PlusIcon className="ml-2" />
          </Button>
          <CreateProjectModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
        </div>
      </SubHeader>

      <Tabs className="container" value={value}>
        <Tabs.List>
          <Tabs.Trigger value={TabValue.Overview} asChild>
            <NextLink href={`/${orgId}`}>Overview</NextLink>
          </Tabs.Trigger>
          {isRegularOrg && canAccessOrganization(OrganizationAccessScope.Members, me) && (
            <Tabs.Trigger value={TabValue.Members} asChild>
              <NextLink href={`/${orgId}/view/${TabValue.Members}`}>Members</NextLink>
            </Tabs.Trigger>
          )}
          {canAccessOrganization(OrganizationAccessScope.Settings, me) && (
            <Tabs.Trigger value={TabValue.Settings} asChild>
              <NextLink href={`/${orgId}/view/${TabValue.Settings}`}>Settings</NextLink>
            </Tabs.Trigger>
          )}
          {getIsStripeEnabled() && canAccessOrganization(OrganizationAccessScope.Settings, me) && (
            <Tabs.Trigger value={TabValue.Subscription} asChild>
              <NextLink href={`/${orgId}/view/${TabValue.Subscription}`}>Subscription</NextLink>
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children({ organization })}
        </Tabs.Content>
      </Tabs>
    </>
  );
}
