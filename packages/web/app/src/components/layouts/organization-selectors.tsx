import { Select } from '@/components/ui/primitives/floating/select/select';
import { graphql, useFragment } from '@/gql';
import { useViewer } from '@/lib/hooks';
import { useRouter } from '@tanstack/react-router';
import * as styles from './organization-selectors.css';

const OrganizationSelector_OrganizationConnectionFragment = graphql(`
  fragment OrganizationSelector_OrganizationConnectionFragment on OrganizationConnection {
    nodes {
      id
      slug
    }
  }
`);

export function OrganizationSelector(props: { currentOrganizationSlug: string }) {
  const router = useRouter();
  const organizations = useFragment(
    OrganizationSelector_OrganizationConnectionFragment,
    useViewer().data?.organizations ?? null,
  )?.nodes;

  if (!organizations) {
    return <div className={styles.organizationSelectorDiv} />;
  }

  return (
    <Select
      aria-label="Organization"
      options={organizations.map(org => ({ value: org.slug, label: org.slug }))}
      value={props.currentOrganizationSlug}
      onValueChange={slug => {
        void router.navigate({
          to: '/$organizationSlug',
          params: {
            organizationSlug: slug,
          },
        });
      }}
      data-cy="organization-picker-trigger"
    />
  );
}
