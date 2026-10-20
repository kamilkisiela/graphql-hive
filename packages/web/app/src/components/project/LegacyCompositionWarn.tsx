import { ReactElement } from 'react';
import { Callout } from '@/components/ui/callout';
import { ProductUpdatesLink } from '@/components/ui/docs-note';
import { Link } from '@/components/ui/link';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import * as styles from './LegacyCompositionWarn.css';

const LegacyCompositionWarn_ProjectFragment = graphql(`
  fragment LegacyCompositionWarn_ProjectFragment on Project {
    id
    slug
    type
    isNativeFederationEnabled
    externalSchemaComposition {
      endpoint
    }
  }
`);

export function LegacyCompositionWarn(props: {
  project: FragmentType<typeof LegacyCompositionWarn_ProjectFragment>;
}): ReactElement | null {
  const { organizationSlug } = useSlugs('project');
  const project = useFragment(LegacyCompositionWarn_ProjectFragment, props.project);

  if (project.type !== ProjectType.Federation) {
    return null;
  }

  const activeMode = project.isNativeFederationEnabled
    ? 'native'
    : project.externalSchemaComposition
      ? 'external'
      : 'legacy';

  if (activeMode !== 'legacy') {
    return null;
  }

  return (
    <Callout type="warning" className={styles.legacyCompositionWarnCallout}>
      <b>This project is using Legacy Federation v1 composition.</b>
      <br />
      Migrate to Native Federation v2 for the recommended composition experience.{' '}
      <Link
        to="/$organizationSlug/$projectSlug/view/settings/composition"
        params={{
          organizationSlug,
          projectSlug: project.slug,
        }}
        className={styles.legacyCompositionWarnLink}
      >
        Open Composition settings
      </Link>
      {' to change it.'}
      <br />
      <ProductUpdatesLink href="2023-10-10-native-federation-2" text="Read the announcement" />
    </Callout>
  );
}
