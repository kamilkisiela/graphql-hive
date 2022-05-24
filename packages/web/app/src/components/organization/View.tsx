import React from 'react';
import { useQuery } from 'urql';
import { VscProject, VscPerson, VscSettings, VscDatabase } from 'react-icons/vsc';
import {
  OrganizationDocument,
  OrganizationFieldsFragment,
  OrganizationType,
  OrgBillingInfoFieldsFragment,
  OrgRateLimitFieldsFragment,
} from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useNavigation } from '@/components/common/Navigation';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { DataWrapper } from '@/components/common/DataWrapper';
import { Title } from '@/components/common';

type Props<IncludingBilling extends boolean, IncludingRateLimit extends boolean> = React.PropsWithChildren<{
  title: string;
  children: React.FC<{
    organization: OrganizationFieldsFragment &
      (IncludingBilling extends true ? OrgBillingInfoFieldsFragment : {}) &
      (IncludingRateLimit extends true ? OrgRateLimitFieldsFragment : {});
  }>;
  includeRateLimit?: IncludingRateLimit;
  includeBilling?: IncludingBilling;
}>;

export function OrganizationView<IncludingBilling extends boolean, IncludingRateLimit extends boolean>({
  title,
  children,
  includeBilling,
  includeRateLimit,
}: Props<IncludingBilling, IncludingRateLimit>) {
  const { setNavigation } = useNavigation();
  const router = useRouteSelector();
  const [query] = useQuery({
    query: OrganizationDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
      includeBilling,
      includeRateLimit,
    },
  });

  const { data } = query;
  const organizationCleanId = data?.organization.organization.cleanId;

  const canAccessMembers = useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    member: data?.organization.organization?.me,
  });
  const canAccessSettings = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: data?.organization.organization?.me,
  });
  const isRegular = data?.organization.organization.type === OrganizationType.Regular;

  React.useEffect(() => {
    if (organizationCleanId) {
      setNavigation({
        organization: organizationCleanId,
        menuTitle: 'Organization',
        menu: [
          {
            exact: true,
            label: 'Dashboard',
            link: `/${router.organizationId}`,
            icon: <VscProject />,
          },
          canAccessMembers && isRegular
            ? {
                label: 'Members',
                link: `/${router.organizationId}/members`,
                icon: <VscPerson />,
              }
            : null,
          canAccessSettings
            ? {
                label: 'Settings',
                link: `/${router.organizationId}/settings`,
                icon: <VscSettings />,
              }
            : null,
          canAccessSettings
            ? {
                label: 'Subscription',
                link: `/${router.organizationId}/subscription`,
                icon: <VscDatabase />,
                exact: false,
              }
            : null,
        ],
      });
    }
  }, [organizationCleanId, setNavigation, canAccessMembers, canAccessSettings]);

  const name = data?.organization?.organization?.name;
  const pageTitle = name ? `${title} - ${name}` : title;

  return (
    <>
      <Title title={pageTitle} />
      <DataWrapper query={query}>
        {() => (
          <>
            {children({
              organization: query.data.organization.organization,
            })}
          </>
        )}
      </DataWrapper>
    </>
  );
}
