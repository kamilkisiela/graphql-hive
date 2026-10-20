import { useCallback, useState } from 'react';
import { FlaskConicalIcon, HeartCrackIcon, PartyPopperIcon, RefreshCcwIcon } from 'lucide-react';
import { CombinedError, useMutation, useQuery } from 'urql';
import { Link } from '@/components/ui/link';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { Switch } from '@/components/ui/primitives/switch/switch';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  NativeFederationCompatibilityStatusType,
  UpdateSchemaCompositionInput,
} from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import * as styles from './native-composition.css';

const IncrementalNativeCompositionSwitch_TargetFragment = graphql(`
  fragment IncrementalNativeCompositionSwitch_TargetFragment on Target {
    id
    slug
    experimental_forcedLegacySchemaComposition
  }
`);

const IncrementalNativeCompositionSwitch_Mutation = graphql(`
  mutation IncrementalNativeCompositionSwitch_Mutation(
    $input: Experimental__UpdateTargetSchemaCompositionInput!
  ) {
    experimental__updateTargetSchemaComposition(input: $input) {
      ...IncrementalNativeCompositionSwitch_TargetFragment
    }
  }
`);

const IncrementalNativeCompositionSwitch = (props: {
  target: FragmentType<typeof IncrementalNativeCompositionSwitch_TargetFragment>;
}) => {
  const { organizationSlug, projectSlug } = useSlugs('project');
  const target = useFragment(IncrementalNativeCompositionSwitch_TargetFragment, props.target);
  const [mutation, mutate] = useMutation(IncrementalNativeCompositionSwitch_Mutation);

  return (
    <div
      className={cn(
        styles.incrementalNativeCompositionSwitchDiv,
        mutation.fetching && styles.incrementalNativeCompositionSwitchDiv2,
      )}
    >
      <div>
        <div className={styles.incrementalNativeCompositionSwitchDiv3}>{target.slug}</div>
        <div className={styles.incrementalNativeCompositionSwitchDiv4}>
          {target.experimental_forcedLegacySchemaComposition ? 'Legacy' : 'Native'} composition
        </div>
      </div>
      <div>
        <Tooltip
          trigger={
            <span className={styles.incrementalNativeCompositionSwitchSpan}>
              <Switch
                disabled={mutation.fetching}
                onCheckedChange={nativeComposition => {
                  void mutate({
                    input: {
                      organizationSlug,
                      projectSlug,
                      targetSlug: target.slug,
                      nativeComposition,
                    },
                  });
                }}
                checked={!target.experimental_forcedLegacySchemaComposition}
              />
            </span>
          }
          sideOffset={2}
          content={
            <>
              <span className={styles.incrementalNativeCompositionSwitchSpan2}>
                {target.experimental_forcedLegacySchemaComposition ? 'Enable' : 'Disable'}
              </span>{' '}
              native composition for the target
            </>
          }
        />
      </div>
    </div>
  );
};

const NativeCompositionSettings_OrganizationFragment = graphql(`
  fragment NativeCompositionSettings_OrganizationFragment on Organization {
    id
    slug
  }
`);

const NativeCompositionSettings_ProjectFragment = graphql(`
  fragment NativeCompositionSettings_ProjectFragment on Project {
    id
    slug
    experimental_nativeCompositionPerTarget
    targets {
      edges {
        node {
          id
          ...IncrementalNativeCompositionSwitch_TargetFragment
        }
      }
    }
  }
`);

const NativeCompositionSettings_ProjectQuery = graphql(`
  query NativeCompositionSettings_ProjectQuery($selector: ProjectSelectorInput!) {
    project(reference: { bySelector: $selector }) {
      id
      nativeFederationCompatibility {
        status
      }
      experimental_nativeCompositionPerTarget
    }
  }
`);

const NativeCompositionSettings_UpdateResultFragment = graphql(`
  fragment NativeCompositionSettings_UpdateResultFragment on UpdateSchemaCompositionResult {
    ok {
      __typename
    }
    error {
      message
    }
  }
`);

export function NativeCompositionSettings(props: {
  organization: FragmentType<typeof NativeCompositionSettings_OrganizationFragment>;
  project: FragmentType<typeof NativeCompositionSettings_ProjectFragment>;
  activeCompositionMode: 'native' | 'external' | 'legacy';
  onMutate: (
    input: UpdateSchemaCompositionInput,
  ) => Promise<FragmentType<typeof NativeCompositionSettings_UpdateResultFragment> | CombinedError>;
}) {
  const organization = useFragment(
    NativeCompositionSettings_OrganizationFragment,
    props.organization,
  );
  const project = useFragment(NativeCompositionSettings_ProjectFragment, props.project);
  const [projectQuery] = useQuery({
    query: NativeCompositionSettings_ProjectQuery,
    variables: {
      selector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
      },
    },
  });

  const { toast } = useToast();

  const [isMutating, setIsMutating] = useState(false);
  const enableNativeComposition = useCallback(async () => {
    setIsMutating(true);
    try {
      const result = await props.onMutate({
        project: {
          bySelector: {
            projectSlug: project.slug,
            organizationSlug: organization.slug,
          },
        },
        method: {
          native: true,
        },
      });

      if (result instanceof CombinedError) {
        toast({
          variant: 'destructive',
          title: 'Failed to enable native composition',
          description: result.message,
        });
      } else {
        // actually not a hook
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const updateResult = useFragment(NativeCompositionSettings_UpdateResultFragment, result);
        if (updateResult.ok) {
          toast({
            title: 'Successfully enabled native composition',
            description:
              'Your project is now using our Open Source composition library for GraphQL Federation.',
          });
        } else if (updateResult.error) {
          toast({
            variant: 'destructive',
            title: 'Failed to enable native composition',
            description: updateResult.error.message,
          });
        }
      }
    } catch (error) {
      console.log('Failed to enable native composition');
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to enable native composition',
        description: String(error),
      });
    } finally {
      setIsMutating(false);
    }
  }, [toast, props.onMutate, organization.slug, project.slug]);

  return (
    <div className={styles.nativeCompositionSettingsDiv}>
      <div>
        <p className={styles.nativeCompositionSettingsP}>
          Recommended for most users. Use native GraphQL Federation v2 composition for your project.
        </p>
      </div>

      {props.activeCompositionMode === 'native' &&
      project.experimental_nativeCompositionPerTarget === true ? (
        <div className={styles.nativeCompositionSettingsDiv2}>
          <div>
            <div className={styles.nativeCompositionSettingsDiv3}>
              <div className={styles.nativeCompositionSettingsDiv4}>Incremental migration</div>
              <Badge content="experimental" variants={{ variant: 'outline' }} />
            </div>
            <div className={styles.nativeCompositionSettingsDiv5}>
              Your project is using the experimental incremental migration feature. <br />
              Migrate targets one by one to the native schema composition.
            </div>
          </div>
          <div>
            <div className={styles.nativeCompositionSettingsDiv6}>
              {project.targets.edges.map(edge => (
                <IncrementalNativeCompositionSwitch key={edge.node.id} target={edge.node} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {projectQuery.fetching ? (
        <Spinner />
      ) : projectQuery.error ? (
        <div className={styles.nativeCompositionSettingsDiv7}>
          <div>
            <HeartCrackIcon className={styles.nativeCompositionSettingsHeartCrackIcon} />
          </div>
          <div>
            <div className={styles.nativeCompositionSettingsDiv8}>
              Failed to check compatibility. Please try again later.
            </div>
          </div>
        </div>
      ) : projectQuery.data?.project ? (
        <div className={styles.nativeCompositionSettingsDiv9}>
          <div>
            {projectQuery.data.project.nativeFederationCompatibility.status ===
            NativeFederationCompatibilityStatusType.Compatible ? (
              <PartyPopperIcon className={styles.nativeCompositionSettingsPartyPopperIcon} />
            ) : null}
            {projectQuery.data.project.nativeFederationCompatibility.status ===
            NativeFederationCompatibilityStatusType.Incompatible ? (
              <HeartCrackIcon className={styles.nativeCompositionSettingsHeartCrackIcon2} />
            ) : null}
            {projectQuery.data.project.nativeFederationCompatibility.status ===
            NativeFederationCompatibilityStatusType.Unknown ? (
              <FlaskConicalIcon className={styles.nativeCompositionSettingsFlaskConicalIcon} />
            ) : null}
          </div>
          <div>
            <div className={styles.nativeCompositionSettingsDiv10}>
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Compatible
                ? 'Your project is compatible'
                : null}
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Incompatible
                ? 'Your project is not yet supported'
                : null}
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Unknown
                ? 'Unclear whether your project is compatible'
                : null}
            </div>
            <div className={styles.nativeCompositionSettingsDiv11}>
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Compatible ? (
                <>
                  Subgraphs of this project are composed and validated correctly by our{' '}
                  <a
                    className={styles.nativeCompositionSettingsA}
                    href="https://github.com/the-guild-org/federation"
                  >
                    Open Source composition library
                  </a>{' '}
                  for GraphQL Federation.
                </>
              ) : null}
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Incompatible ? (
                <>
                  Our{' '}
                  <a
                    className={styles.nativeCompositionSettingsA2}
                    href="https://github.com/the-guild-org/federation"
                  >
                    Open Source composition library
                  </a>{' '}
                  is not yet compatible with subgraphs of your project. We're working on it!
                  <br />
                  To determine the cause of this issue, view the{' '}
                  <Link
                    variant="primary"
                    target="_blank"
                    to={`/native-composition-compatibility-report/${projectQuery.data.project.id}`}
                  >
                    Native Composition Report
                  </Link>
                  .<br />
                  <br />
                  If unclear, please reach out to us to explore solutions for addressing this issue.
                </>
              ) : null}
              {projectQuery.data.project.nativeFederationCompatibility.status ===
              NativeFederationCompatibilityStatusType.Unknown ? (
                <>
                  Your project appears to lack any subgraphs at the moment, making it impossible for
                  us to assess compatibility with our{' '}
                  <a
                    className={styles.nativeCompositionSettingsA3}
                    href="https://github.com/the-guild-org/federation"
                  >
                    Open Source composition library
                  </a>
                  .
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.nativeCompositionSettingsDiv12}>
        <Button
          onClick={() => enableNativeComposition()}
          disabled={isMutating || props.activeCompositionMode === 'native'}
        >
          {isMutating ? (
            <>
              <RefreshCcwIcon className={styles.nativeCompositionSettingsRefreshCcwIcon} />
              Please wait
            </>
          ) : props.activeCompositionMode === 'native' ? (
            'Using Native Composition'
          ) : (
            'Use Native Composition'
          )}
        </Button>
        <div>
          <Button
            variant="link"
            anchor={{
              href: 'https://github.com/the-guild-org/federation?tab=readme-ov-file#compatibility',
            }}
          >
            Learn more about risks and compatibility with other composition libraries
          </Button>
        </div>
      </div>
    </div>
  );
}
