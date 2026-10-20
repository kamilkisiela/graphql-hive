import { useCallback, useState } from 'react';
import { RefreshCcwIcon } from 'lucide-react';
import { CombinedError } from 'urql';
import { ProductUpdatesLink } from '@/components/ui/docs-note';
import { Button } from '@/components/ui/primitives/button/button';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import { UpdateSchemaCompositionInput } from '@/gql/graphql';
import * as styles from './legacy-composition.css';

const LegacyCompositionSettings_OrganizationFragment = graphql(`
  fragment LegacyCompositionSettings_OrganizationFragment on Organization {
    id
    slug
  }
`);

const LegacyCompositionSettings_ProjectFragment = graphql(`
  fragment LegacyCompositionSettings_ProjectFragment on Project {
    id
    slug
  }
`);

const LegacyCompositionSettings_UpdateResultFragment = graphql(`
  fragment LegacyCompositionSettings_UpdateResultFragment on UpdateSchemaCompositionResult {
    ok {
      __typename
    }
    error {
      message
    }
  }
`);

export function LegacyCompositionSettings(props: {
  organization: FragmentType<typeof LegacyCompositionSettings_OrganizationFragment>;
  project: FragmentType<typeof LegacyCompositionSettings_ProjectFragment>;
  activeCompositionMode: 'native' | 'external' | 'legacy';
  onMutate: (
    input: UpdateSchemaCompositionInput,
  ) => Promise<FragmentType<typeof LegacyCompositionSettings_UpdateResultFragment> | CombinedError>;
}) {
  const organization = useFragment(
    LegacyCompositionSettings_OrganizationFragment,
    props.organization,
  );
  const project = useFragment(LegacyCompositionSettings_ProjectFragment, props.project);

  const { toast } = useToast();

  const [isMutating, setIsMutating] = useState(false);
  const enableLegacyComposition = useCallback(async () => {
    const previousCompositionMode = props.activeCompositionMode;
    try {
      const result = await props.onMutate({
        project: {
          bySelector: {
            projectSlug: project.slug,
            organizationSlug: organization.slug,
          },
        },
        method: {
          legacy: true,
        },
      });

      if (result instanceof CombinedError) {
        toast({
          variant: 'destructive',
          title: 'Failed to enable legacy composition',
          description: result.message,
        });
      } else {
        // actually not a hook
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const updateResult = useFragment(LegacyCompositionSettings_UpdateResultFragment, result);
        if (updateResult.ok) {
          toast({
            title: 'Successfully enabled legacy composition',
            description: `Your project is no longer using ${
              previousCompositionMode
            } schema composition.`,
          });
        } else if (updateResult.error) {
          toast({
            variant: 'destructive',
            title: 'Failed to enable legacy composition',
            description: updateResult.error.message,
          });
        }
      }
    } catch (error) {
      console.log('Failed to enable legacy composition');
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to enable legacy composition',
        description: String(error),
      });
    } finally {
      setIsMutating(false);
    }
  }, [toast, props.activeCompositionMode, props.onMutate, organization.slug, project.slug]);

  return (
    <div className={styles.legacyCompositionSettingsDiv}>
      <div>
        <p className={styles.legacyCompositionSettingsP}>
          Not recommended. Migrate towards using Native Federation v2.
        </p>
        <ProductUpdatesLink href="2023-10-10-native-federation-2" text="Read the announcement!" />
      </div>

      <div className={styles.legacyCompositionSettingsDiv2}>
        <Button
          variant="destructive"
          onClick={() => enableLegacyComposition()}
          disabled={isMutating || props.activeCompositionMode === 'legacy'}
        >
          {isMutating ? (
            <>
              <RefreshCcwIcon className={styles.legacyCompositionSettingsRefreshCcwIcon} />
              Please wait
            </>
          ) : props.activeCompositionMode === 'legacy' ? (
            'Using Legacy Composition'
          ) : (
            'Use Legacy Composition'
          )}
        </Button>
      </div>
    </div>
  );
}
