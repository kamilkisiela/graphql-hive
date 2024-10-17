import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Link, useRouter } from '@tanstack/react-router';

const TargetSelector_OrganizationConnectionFragment = graphql(`
  fragment TargetSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
      projects {
        nodes {
          id
          slug
          targets {
            nodes {
              id
              slug
            }
          }
        }
      }
    }
  }
`);

export function TargetSelector(props: {
  currentOrganizationSlug: string;
  currentProjectSlug: string;
  currentTargetSlug: string;
  organizations: FragmentType<typeof TargetSelector_OrganizationConnectionFragment> | null;
}) {
  const router = useRouter();

  const organizations = useFragment(
    TargetSelector_OrganizationConnectionFragment,
    props.organizations,
  )?.nodes;

  const currentOrganization = organizations?.find(
    node => node.slug === props.currentOrganizationSlug,
  );

  const projects = currentOrganization?.projects.nodes;
  const currentProject = projects?.find(node => node.slug === props.currentProjectSlug);

  const targets = currentProject?.targets.nodes;
  const currentTarget = targets?.find(node => node.slug === props.currentTargetSlug);

  return (
    <>
      {currentOrganization ? (
        <Link
          to="/$organizationSlug"
          params={{
            organizationSlug: currentOrganization.slug,
          }}
          className="max-w-[200px] shrink-0 truncate font-medium"
        >
          {currentOrganization.slug}
        </Link>
      ) : (
        <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
      )}
      <div className="italic text-gray-500">/</div>
      {currentOrganization && currentProject ? (
        <Link
          to="/$organizationSlug/$projectSlug"
          params={{
            organizationSlug: props.currentOrganizationSlug,
            projectSlug: props.currentProjectSlug,
          }}
          className="max-w-[200px] shrink-0 truncate font-medium"
        >
          {currentProject.slug}
        </Link>
      ) : (
        <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
      )}
      <div className="italic text-gray-500">/</div>
      {targets?.length && currentOrganization && currentProject && currentTarget ? (
        <>
          <Select
            value={props.currentTargetSlug}
            onValueChange={id => {
              void router.navigate({
                to: '/$organizationSlug/$projectSlug/$targetSlug',
                params: {
                  organizationSlug: props.currentOrganizationSlug,
                  projectSlug: props.currentProjectSlug,
                  targetSlug: id,
                },
              });
            }}
          >
            <SelectTrigger variant="default">
              <div className="font-medium">{currentTarget.slug}</div>
            </SelectTrigger>
            <SelectContent>
              {targets.map(target => (
                <SelectItem key={target.slug} value={target.slug}>
                  {target.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
      )}
    </>
  );
}
