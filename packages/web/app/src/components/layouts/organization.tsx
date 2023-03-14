import { ReactElement, ReactNode, useEffect } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import cookies from 'js-cookie';
import { TypedDocumentNode, useQuery } from 'urql';
import { Button, Heading, SubHeader, Tabs } from '@/components/v2';
import { PlusIcon } from '@/components/v2/icon';
import { CreateProjectModal } from '@/components/v2/modals';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Exact } from '@/graphql';
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
  Policy = 'policy',
  Subscription = 'subscription',
}

const OrganizationLayout_OrganizationFragment = graphql(`
  fragment OrganizationLayout_OrganizationFragment on Organization {
    name
    me {
      ...CanAccessOrganization_MemberFragment
    }
  }
`);

export function OrganizationLayout<
  TSatisfiesType extends {
    organization?:
      | {
          organization?: FragmentType<typeof OrganizationLayout_OrganizationFragment> | null;
        }
      | null
      | undefined;
  },
>({
  children,
  value,
  query,
  className,
}: {
  children(
    props: TSatisfiesType,
    selector: {
      organization: string;
    },
  ): ReactNode;
  value?: 'overview' | 'members' | 'settings' | 'subscription' | 'policy';
  className?: string;
  query: TypedDocumentNode<
    TSatisfiesType,
    Exact<{
      selector: {
        organization: string;
      };
    }>
  >;
}): ReactElement | null {
  const router = useRouteSelector();
  const { push } = useRouter();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const orgId = router.organizationId;

  const [organizationQuery] = useQuery({
    query,
    variables: {
      selector: {
        organization: orgId,
      },
    },
  });

  const organization = useFragment(
    OrganizationLayout_OrganizationFragment,
    organizationQuery.data?.organization?.organization,
  );

  useEffect(() => {
    if (organizationQuery.error) {
      cookies.remove(LAST_VISITED_ORG_KEY);
      // url with # provoke error Maximum update depth exceeded
      void push('/404', router.asPath.replace(/#.*/, ''));
    }
  }, [organizationQuery.error, router]);

  useOrganizationAccess({
    member: organization?.me ?? null,
    scope: OrganizationAccessScope.Read,
    redirect: true,
  });

  if (organizationQuery.fetching || organizationQuery.error) {
    return null;
  }

  const me = organization?.me;

  if (!organization || !me) {
    return null;
  }

  if (!value) {
    return (
      <>
        {children(organizationQuery.data!, {
          organization: orgId,
        })}
      </>
    );
  }

  return (
    <>
      <SubHeader>
        <div className="container flex h-[84px] items-center justify-between">
          <div className="truncate">
            <Heading size="2xl" className="inline">
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
          {canAccessOrganization(OrganizationAccessScope.Members, me) && (
            <Tabs.Trigger value={TabValue.Members} asChild>
              <NextLink href={`/${orgId}/view/${TabValue.Members}`}>Members</NextLink>
            </Tabs.Trigger>
          )}
          {canAccessOrganization(OrganizationAccessScope.Settings, me) && (
            <>
              <Tabs.Trigger value={TabValue.Policy} asChild>
                <NextLink href={`/${orgId}/view/${TabValue.Policy}`}>Policy</NextLink>
              </Tabs.Trigger>
              <Tabs.Trigger value={TabValue.Settings} asChild>
                <NextLink href={`/${orgId}/view/${TabValue.Settings}`}>Settings</NextLink>
              </Tabs.Trigger>
            </>
          )}
          {getIsStripeEnabled() && canAccessOrganization(OrganizationAccessScope.Settings, me) && (
            <Tabs.Trigger value={TabValue.Subscription} asChild>
              <NextLink href={`/${orgId}/view/${TabValue.Subscription}`}>Subscription</NextLink>
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Content value={value} className={className}>
          {children(organizationQuery.data!, {
            organization: orgId,
          })}
        </Tabs.Content>
      </Tabs>
    </>
  );
}
