import { PrimaryNavigationLink } from '@/components/navigation/primary-navigation-link';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { graphql, useFragment } from '@/gql';
import { useViewer } from '@/lib/hooks';
import { useRouter } from '@tanstack/react-router';
import * as styles from './project-selector.css';

const ProjectSelector_OrganizationConnectionFragment = graphql(`
  fragment ProjectSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
      projects {
        edges {
          node {
            id
            slug
          }
        }
      }
    }
  }
`);

export function ProjectSelector(props: {
  currentOrganizationSlug: string;
  currentProjectSlug: string;
}) {
  const router = useRouter();

  const organizations = useFragment(
    ProjectSelector_OrganizationConnectionFragment,
    useViewer().data?.organizations ?? null,
  )?.nodes;

  const currentOrganization = organizations?.find(
    node => node.slug === props.currentOrganizationSlug,
  );

  const projectEdges = currentOrganization?.projects.edges;
  const currentProject = projectEdges?.find(
    edge => edge.node.slug === props.currentProjectSlug,
  )?.node;

  return (
    <>
      {currentOrganization ? (
        <PrimaryNavigationLink
          linkProps={{
            to: '/$organizationSlug',
            params: { organizationSlug: props.currentOrganizationSlug },
          }}
          linkText={currentOrganization.slug}
        />
      ) : (
        <div className={styles.projectSelectorDiv} />
      )}
      {projectEdges?.length && currentProject ? (
        <>
          <div className={styles.projectSelectorDiv2}>/</div>
          <Select
            aria-label="Project"
            options={projectEdges.map(edge => ({ value: edge.node.slug, label: edge.node.slug }))}
            value={props.currentProjectSlug}
            onValueChange={id => {
              void router.navigate({
                to: '/$organizationSlug/$projectSlug',
                params: {
                  organizationSlug: props.currentOrganizationSlug,
                  projectSlug: id,
                },
              });
            }}
            data-cy="project-picker-trigger"
          />
        </>
      ) : (
        <div className={styles.projectSelectorDiv3} />
      )}
    </>
  );
}
