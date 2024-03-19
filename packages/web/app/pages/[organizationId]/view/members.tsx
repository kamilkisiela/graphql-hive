import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { OrganizationInvitations } from '@/components/organization/members/invitations';
import { OrganizationMembers } from '@/components/organization/members/list';
import { OrganizationMemberRolesMigration } from '@/components/organization/members/migration';
import { OrganizationMemberRoles } from '@/components/organization/members/roles';
import { Button } from '@/components/ui/button';
import { QueryError } from '@/components/ui/query-error';
import { MetaTitle } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { cn } from '@/lib/utils';

const OrganizationMembersPage_OrganizationFragment = graphql(`
  fragment OrganizationMembersPage_OrganizationFragment on Organization {
    me {
      id
      isAdmin
      ...CanAccessOrganization_MemberFragment
      ...OrganizationMemberRoleSwitcher_MemberFragment
    }
    cleanId
    ...OrganizationInvitations_OrganizationFragment
    ...OrganizationMemberRoles_OrganizationFragment
    ...OrganizationMembers_OrganizationFragment
    ...OrganizationMemberRolesMigration_OrganizationFragment
  }
`);

const subPages = [
  {
    key: 'list',
    title: 'Members',
  },
  {
    key: 'roles',
    title: 'Roles',
  },
  {
    key: 'invitations',
    title: 'Invitations',
  },
  {
    key: 'migration',
    title: 'Migration',
  },
] as const;

type SubPage = (typeof subPages)[number]['key'];

function PageContent(props: {
  organization: FragmentType<typeof OrganizationMembersPage_OrganizationFragment>;

  refetchQuery(): void;
}) {
  const organization = useFragment(
    OrganizationMembersPage_OrganizationFragment,
    props.organization,
  );

  const router = useRouter();
  const pageFromUrl =
    typeof router.query.page === 'string' && subPages.some(p => p.key === router.query.page)
      ? (router.query.page as SubPage)
      : typeof window === 'undefined'
        ? null
        : // we do it because sometimes useRouter().query.page is undefined when adding a role...
          (new URL(window.location.href).searchParams.get('page') as SubPage | null) ?? null;
  const [page, setPage] = useState<SubPage>(pageFromUrl ?? 'list');
  const changePage = useCallback(
    (newPage: SubPage) => {
      if (page === newPage) {
        return;
      }

      if (newPage === 'list') {
        setPage('list');
        void router.push(
          '/[organizationId]/view/members',
          `/${organization.cleanId}/view/members`,
          {
            shallow: true,
          },
        );
        return;
      }

      setPage(newPage);
      void router.push(
        '/[organizationId]/view/members',
        `/${organization.cleanId}/view/members?page=${newPage}`,
        {
          shallow: true,
        },
      );
    },
    [page, setPage, router],
  );

  const hasAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    redirect: true,
    member: organization.me,
  });

  if (!organization || !hasAccess) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row gap-x-6 py-6">
        <nav className="flex w-48 flex-col space-x-0 space-y-1">
          {subPages.map(subPage => {
            // hide migration page from non-admins
            if (subPage.key === 'migration' && !organization.me.isAdmin) {
              return null;
            }

            return (
              <Button
                key={subPage.key}
                variant="ghost"
                onClick={() => changePage(subPage.key)}
                className={cn(
                  page === subPage.key
                    ? 'bg-muted hover:bg-muted'
                    : 'hover:bg-transparent hover:underline',
                  'justify-start',
                )}
              >
                {subPage.title}
              </Button>
            );
          })}
        </nav>
        <div className="grow">
          {page === 'roles' ? <OrganizationMemberRoles organization={organization} /> : null}
          {page === 'list' ? (
            <OrganizationMembers refetchMembers={props.refetchQuery} organization={organization} />
          ) : null}
          {page === 'invitations' ? (
            <OrganizationInvitations
              refetchInvitations={props.refetchQuery}
              organization={organization}
            />
          ) : null}
          {page === 'migration' && organization.me.isAdmin ? (
            <OrganizationMemberRolesMigration organization={organization} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

const OrganizationMembersPageQuery = graphql(`
  query OrganizationMembersPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_CurrentOrganizationFragment
        ...OrganizationMembersPage_OrganizationFragment
      }
    }
    organizations {
      ...OrganizationLayout_OrganizationConnectionFragment
    }
    me {
      id
      ...OrganizationLayout_MeFragment
    }
  }
`);

function OrganizationMembersPageContent() {
  const router = useRouteSelector();
  const [query, refetch] = useQuery({
    query: OrganizationMembersPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  return (
    <OrganizationLayout
      page={Page.Members}
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
    >
      {currentOrganization ? (
        <PageContent
          refetchQuery={() => {
            refetch({ requestPolicy: 'network-only' });
          }}
          organization={currentOrganization}
        />
      ) : null}
    </OrganizationLayout>
  );
}

function OrganizationMembersPage() {
  return (
    <>
      <MetaTitle title="Members" />
      <OrganizationMembersPageContent />
    </>
  );
}

export default authenticated(OrganizationMembersPage);
