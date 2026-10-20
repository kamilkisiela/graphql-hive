import { PrimaryNavigationLink } from '@/components/navigation/primary-navigation-link';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { graphql, useFragment } from '@/gql';
import { useViewer } from '@/lib/hooks';
import { useRouter } from '@tanstack/react-router';
import { resolveTargetSwitchTo, TARGET_ROUTE_PREFIX } from './target-selector.utils';
import * as styles from './target-selector.css';

const TargetSelector_OrganizationConnectionFragment = graphql(`
  fragment TargetSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
      projects {
        edges {
          node {
            id
            slug
            targets {
              edges {
                node {
                  id
                  slug
                }
              }
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
}) {
  const router = useRouter();

  const organizations = useFragment(
    TargetSelector_OrganizationConnectionFragment,
    useViewer().data?.organizations ?? null,
  )?.nodes;

  const currentOrganization = organizations?.find(
    node => node.slug === props.currentOrganizationSlug,
  );

  const projects = currentOrganization?.projects.edges;
  const currentProject = projects?.find(edge => edge.node.slug === props.currentProjectSlug)?.node;

  const targetEdges = currentProject?.targets.edges;
  const currentTarget = targetEdges?.find(edge => edge.node.slug === props.currentTargetSlug)?.node;

  const onTargetChange = (targetSlug: string) => {
    // Navigate to the current section under the new target, dropping the previous target's
    // resource ids (e.g. the schema version id under /history/$versionId) that would otherwise
    // resolve to "not found"; the section then picks its own default.
    const to = resolveTargetSwitchTo(
      router.state.matches.map(match => router.routesById[match.routeId]?.fullPath),
      Object.values(router.routesById).map(route => route.fullPath),
    );
    void router.navigate({
      // every resolved section needs exactly the three target-level params
      to: to as typeof TARGET_ROUTE_PREFIX,
      params: {
        organizationSlug: props.currentOrganizationSlug,
        projectSlug: props.currentProjectSlug,
        targetSlug,
      },
    });
  };

  return (
    <>
      {currentOrganization ? (
        <PrimaryNavigationLink
          linkProps={{
            to: '/$organizationSlug',
            params: { organizationSlug: currentOrganization.slug },
          }}
          linkText={currentOrganization.slug}
        />
      ) : (
        <div className={styles.targetSelectorDiv} />
      )}
      <div className={styles.targetSelectorDiv2}>/</div>
      {currentOrganization && currentProject ? (
        <PrimaryNavigationLink
          linkProps={{
            to: '/$organizationSlug/$projectSlug',
            params: {
              organizationSlug: props.currentOrganizationSlug,
              projectSlug: props.currentProjectSlug,
            },
          }}
          linkText={currentProject.slug}
        />
      ) : (
        <div className={styles.targetSelectorDiv3} />
      )}
      <div className={styles.targetSelectorDiv4}>/</div>
      {targetEdges?.length && currentOrganization && currentProject && currentTarget ? (
        <Select
          aria-label="Target"
          options={targetEdges.map(edge => ({ value: edge.node.slug, label: edge.node.slug }))}
          value={props.currentTargetSlug}
          onValueChange={onTargetChange}
          data-cy="target-picker-trigger"
        />
      ) : (
        <div className={styles.targetSelectorDiv5} />
      )}
    </>
  );
}
