import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouter } from '@tanstack/react-router';

const OrganizationSelector_OrganizationConnectionFragment = graphql(`
  fragment OrganizationSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
    }
  }
`);

export function OrganizationSelector(props: {
  currentOrganizationSlug: string;
  organizations: FragmentType<typeof OrganizationSelector_OrganizationConnectionFragment> | null;
}) {
  const router = useRouter();
  const organizations = useFragment(
    OrganizationSelector_OrganizationConnectionFragment,
    props.organizations,
  )?.nodes;

  const currentOrganization = organizations?.find(
    node => node.slug === props.currentOrganizationSlug,
  );

  return organizations ? (
    <Select
      value={props.currentOrganizationSlug}
      onValueChange={id => {
        void router.navigate({
          to: '/$organizationSlug',
          params: {
            organizationSlug: id,
          },
        });
      }}
    >
      <SelectTrigger variant="default">
        <div className="font-medium" data-cy="organization-picker-current">
          {currentOrganization?.slug}
        </div>
      </SelectTrigger>
      <SelectContent>
        {organizations.map(org => (
          <SelectItem key={org.slug} value={org.slug}>
            {org.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <div className="h-5 w-48 animate-pulse rounded-full bg-gray-800" />
  );
}
