import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Link, useRouter } from '@tanstack/react-router';

const ProjectSelector_OrganizationConnectionFragment = graphql(`
  fragment ProjectSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
      projects {
        nodes {
          id
          slug
        }
      }
    }
  }
`);

export function ProjectSelector(props: {
  currentOrganizationCleanId: string;
  currentProjectCleanId: string;
  organizations: FragmentType<typeof ProjectSelector_OrganizationConnectionFragment> | null;
}) {
  const router = useRouter();

  const organizations = useFragment(
    ProjectSelector_OrganizationConnectionFragment,
    props.organizations,
  )?.nodes;

  const currentOrganization = organizations?.find(
    node => node.slug === props.currentOrganizationCleanId,
  );

  const projects = currentOrganization?.projects.nodes;
  const currentProject = projects?.find(node => node.slug === props.currentProjectCleanId);

  return (
    <>
      {currentOrganization ? (
        <Link
          to="/$organizationId"
          params={{ organizationId: props.currentOrganizationCleanId }}
          className="max-w-[200px] shrink-0 truncate font-medium"
        >
          {currentOrganization.slug}
        </Link>
      ) : (
        <div className="h-5 w-48 max-w-[200px] animate-pulse rounded-full bg-gray-800" />
      )}
      {projects?.length && currentProject ? (
        <>
          <div className="italic text-gray-500">/</div>
          <Select
            value={props.currentProjectCleanId}
            onValueChange={id => {
              void router.navigate({
                to: '/$organizationId/$projectId',
                params: {
                  organizationId: props.currentOrganizationCleanId,
                  projectId: id,
                },
              });
            }}
          >
            <SelectTrigger variant="default">
              <div className="font-medium">{currentProject.slug}</div>
            </SelectTrigger>
            <SelectContent>
              {projects.map(project => (
                <SelectItem key={project.slug} value={project.slug}>
                  {project.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="h-5 w-48 animate-pulse rounded-full bg-gray-800" />
      )}
    </>
  );
}
