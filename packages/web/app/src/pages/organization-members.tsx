import { useQuery } from 'urql';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { OrganizationInvitations } from '@/components/organization/members/invitations';
import { OrganizationMembers } from '@/components/organization/members/list';
import { OrganizationMemberRolesMigration } from '@/components/organization/members/migration';
import { OrganizationMemberRoles } from '@/components/organization/members/roles';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/meta';
import { NavLayout, PageLayout, PageLayoutContent } from '@/components/ui/page-content-layout';
import { QueryError } from '@/components/ui/query-error';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { cn } from '@/lib/utils';

const OrganizationMembersPage_OrganizationFragment = graphql(`
  fragment OrganizationMembersPage_OrganizationFragment on Organization {
    me {
      id
      isAdmin
      ...CanAccessOrganization_MemberFragment
      ...OrganizationMemberRoleSwitcher_MemberFragment
    }
    slug
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
  page: SubPage;
  onPageChange(page: SubPage): void;
  organization: FragmentType<typeof OrganizationMembersPage_OrganizationFragment>;
  refetchQuery(): void;
}) {
  const organization = useFragment(
    OrganizationMembersPage_OrganizationFragment,
    props.organization,
  );

  const hasAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    redirect: true,
    member: organization.me,
    organizationSlug: organization.slug,
  });

  if (!organization || !hasAccess) {
    return null;
  }

  return (
    <PageLayout>
      <NavLayout>
        {subPages.map(subPage => {
          // hide migration page from non-admins
          if (subPage.key === 'migration' && !organization.me.isAdmin) {
            return null;
          }
          return (
            <Button
              key={subPage.key}
              variant="ghost"
              className={cn(
                props.page === subPage.key
                  ? 'bg-muted hover:bg-muted'
                  : 'hover:bg-transparent hover:underline',
                'justify-start',
              )}
              onClick={() => props.onPageChange(subPage.key)}
            >
              {subPage.title}
            </Button>
          );
        })}
      </NavLayout>
      <PageLayoutContent>
        {props.page === 'roles' ? <OrganizationMemberRoles organization={organization} /> : null}
        {props.page === 'list' ? (
          <OrganizationMembers refetchMembers={props.refetchQuery} organization={organization} />
        ) : null}
        {props.page === 'invitations' ? (
          <OrganizationInvitations
            refetchInvitations={props.refetchQuery}
            organization={organization}
          />
        ) : null}
        {props.page === 'migration' && organization.me.isAdmin ? (
          <OrganizationMemberRolesMigration organization={organization} />
        ) : null}
      </PageLayoutContent>
    </PageLayout>
  );
}

const OrganizationMembersPageQuery = graphql(`
  query OrganizationMembersPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationMembersPage_OrganizationFragment
      }
    }
  }
`);

function OrganizationMembersPageContent(props: {
  organizationSlug: string;
  page: SubPage;
  onPageChange(page: SubPage): void;
}) {
  const [query, refetch] = useQuery({
    query: OrganizationMembersPageQuery,
    variables: {
      selector: {
        organizationSlug: props.organizationSlug,
      },
    },
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const currentOrganization = query.data?.organization?.organization;

  return (
    <OrganizationLayout
      organizationSlug={props.organizationSlug}
      page={Page.Members}
      className="flex flex-col gap-y-10"
    >
      {currentOrganization ? (
        <PageContent
          page={props.page}
          onPageChange={props.onPageChange}
          refetchQuery={() => {
            refetch({ requestPolicy: 'network-only' });
          }}
          organization={currentOrganization}
        />
      ) : null}
    </OrganizationLayout>
  );
}

export function OrganizationMembersPage(props: {
  organizationSlug: string;
  page: SubPage;
  onPageChange(page: SubPage): void;
}) {
  return (
    <>
      <Meta title="Members" />
      <OrganizationMembersPageContent
        organizationSlug={props.organizationSlug}
        page={props.page}
        onPageChange={props.onPageChange}
      />
    </>
  );
}
