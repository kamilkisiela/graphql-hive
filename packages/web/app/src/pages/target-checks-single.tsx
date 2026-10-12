import { Fragment, ReactElement, ReactNode, useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  BadgeCheck,
  CheckIcon,
  ChevronDown,
  ChevronUp,
  CircleQuestionMarkIcon,
  FileDiffIcon,
  GitCompareIcon,
  InfoIcon,
  ListIcon,
  Loader2,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { ServiceFilterButton } from '@/components/target/checks/service-filter-button';
import {
  ChangesBlock,
  CompositionErrorsList,
  CompositionErrorsSection,
  labelize,
  NoGraphChanges,
} from '@/components/target/history/errors-and-changes';
import { CopyText } from '@/components/ui/copy-text';
import { DownloadButton } from '@/components/ui/diff-editor';
import { CodeScrollArea, File } from '@/components/ui/diffs';
import { DocsLink } from '@/components/ui/docs-note';
import { EmptyList } from '@/components/ui/empty-list';
import { FailureCard, formatCount } from '@/components/ui/failure-card/failure-card';
import { Heading } from '@/components/ui/heading';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Button } from '@/components/ui/primitives/button/button';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { Label } from '@/components/ui/primitives/label/label';
import { ScrollArea } from '@/components/ui/primitives/scroll-area/scroll-area';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { Switch } from '@/components/ui/primitives/switch/switch';
import { Textarea } from '@/components/ui/primitives/textarea/textarea';
import { QueryError } from '@/components/ui/query-error';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { TabbedView, type TabbedViewItem } from '@/components/ui/tabbed-view/tabbed-view';
import { TimeAgo } from '@/components/ui/time-ago';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import { SDLDiffView, SDLView } from './target-history-schema-version';

/** A status icon inside a tab, explained on hover. */
function StatusTooltip(props: { icon: ReactNode; label: string }) {
  return (
    <Tooltip trigger={<span className="inline-flex">{props.icon}</span>} content={props.label} />
  );
}

function AnnotatedSDLView(props: {
  sdl: string;
  annotations?: Array<{
    message: string;
    severity: 'error' | 'warning';
    start: { line: number; character: number };
    end: { line: number; character: number };
  }>;
}) {
  return (
    <CodeScrollArea>
      <div className="max-w-[inherit]">
        <File
          file={{
            name: 'schema.graphql',
            contents: props.sdl,
          }}
          options={{
            disableFileHeader: true,
          }}
          lineAnnotations={props.annotations?.map(annotation => ({
            lineNumber: annotation.start.line,
            metadata: { message: annotation.message, severity: annotation.severity },
          }))}
          renderAnnotation={annotation => (
            <div
              className={cn(
                'flex items-center border-l-5 pl-1',
                annotation.metadata.severity === 'warning'
                  ? 'border-warning-line bg-warning-tint text-warning'
                  : 'border-critical bg-critical-tint text-critical',
              )}
            >
              <span>{annotation.metadata.message}</span>
              {annotation.metadata.severity === 'warning' ? (
                <TriangleAlertIcon className="mr-2 ml-auto size-4 text-warning" />
              ) : (
                <ShieldAlertIcon className="mr-2 ml-auto size-4 text-critical" />
              )}
            </div>
          )}
        />
      </div>
    </CodeScrollArea>
  );
}

function SDLSingleView(props: {
  title?: ReactElement;
  sdl: string;
  downloadFileName?: string;
}): ReactElement {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between border-b border-line-subtle px-2 py-1">
        <div className="px-2 font-bold">{props.title}</div>
        <div className="ml-auto flex h-[36px] items-center px-2">
          {props.sdl && props.downloadFileName && (
            <DownloadButton fileName={props.downloadFileName} contents={props.sdl} />
          )}
        </div>
      </div>
      <SDLView sdl={props.sdl} />
    </div>
  );
}

function SDLSingleDiffToggleView(props: {
  title?: ReactElement;
  before: string | null;
  after: string | null;
  downloadFileName?: string;
}): ReactElement {
  const [showDiff, setShowDiff] = useState<boolean>(true);
  const title = props?.title ?? 'Diff View';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between border-b border-line-subtle px-2 py-1">
        <div className="px-2 font-bold">{title}</div>
        <div className="ml-auto flex h-[36px] items-center px-2">
          {props.after && props.downloadFileName && (
            <DownloadButton fileName={props.downloadFileName} contents={props.after} />
          )}

          <div className="ml-2 flex items-center space-x-2">
            <Label variant="inline" htmlFor="toggle-diff-mode" label="Toggle Diff" />
            <Switch
              id="toggle-diff-mode"
              checked={showDiff}
              onCheckedChange={isChecked => setShowDiff(isChecked)}
            />
          </div>
        </div>
      </div>
      {showDiff ? (
        <SDLDiffView before={props.before ?? ''} after={props.after ?? ''} />
      ) : (
        <SDLView sdl={props.after ?? ''} />
      )}
    </div>
  );
}

const ApproveFailedSchemaCheckMutation = graphql(`
  mutation ApproveFailedSchemaCheckModal_ApproveFailedSchemaCheckMutation(
    $input: ApproveFailedSchemaCheckInput!
  ) {
    approveFailedSchemaCheck(input: $input) {
      ok {
        schemaCheck {
          ...ActiveSchemaCheck_SchemaCheckFragment
        }
      }
      error {
        message
      }
    }
  }
`);

function ApproveFailedSchemaCheckModal(props: {
  schemaCheckId: string;
  contextId: string | null | undefined;
  onClose(): void;
}) {
  const [mutation, approve] = useMutation(ApproveFailedSchemaCheckMutation);
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [approvalComment, setApprovalComment] = useState<string>('');
  const onApprovalCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setApprovalComment(e.target.value);
    },
    [setApprovalComment],
  );

  if (mutation.error) {
    return (
      <div className="space-y-2">
        <h4 className="leading-none font-medium">Oops. Something unexpected happened</h4>
        <p className="text-sm text-fg-secondary">{mutation.error.message}</p>
        <div className="text-right">
          <Button onSurface="raised" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (mutation.data?.approveFailedSchemaCheck.error) {
    return (
      <div className="space-y-2">
        <h4 className="leading-none font-medium">Approval failed</h4>
        <p className="text-sm text-fg-secondary">
          {mutation.data.approveFailedSchemaCheck.error.message}
        </p>
        <div className="text-right">
          <Button onSurface="raised" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (mutation.data?.approveFailedSchemaCheck.ok) {
    return (
      <div className="space-y-2">
        <h4 className="leading-none font-medium">
          The schema check has been approved successfully!
        </h4>
        <div className="text-right">
          <Button onSurface="raised" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="leading-none font-medium">Finish your approval</h4>
      <div>
        <p className="text-sm text-fg-secondary">Acknowledge and accept breaking changes.</p>
        {props?.contextId ? (
          <p className="text-sm text-fg-secondary">
            Approval applies to all future changes within the context of a pull request or branch
            lifecycle: <span className="font-medium">{props?.contextId}</span>
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Textarea
          value={approvalComment}
          onChange={onApprovalCommentChange}
          placeholder="(Optional)  Add a comment..."
        />
        <div className="text-right">
          <Button
            variant="destructive"
            disabled={mutation.fetching}
            onClick={async e => {
              e.preventDefault();
              await approve({
                input: {
                  organizationSlug,
                  projectSlug,
                  targetSlug,
                  schemaCheckId: props.schemaCheckId,
                  comment: approvalComment,
                },
              });
              props.onClose();
            }}
          >
            {mutation.fetching ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Please wait
              </>
            ) : (
              'Approve Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const BreakingChangesTitle = () => {
  return (
    <>
      Breaking Changes
      <Popover
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="About breaking changes">
            <InfoIcon className="size-3" />
          </Button>
        }
        openOnHover
        align="start"
        width="xl"
        content={
          <div className="font-normal text-fg-default">
            <h5 className="mb-1 text-lg font-bold">Breaking Changes</h5>
            <p className="mb-2 text-sm">Schema changes that can potentially break clients.</p>
            <h6 className="mb-1 font-bold">Breaking Change Approval</h6>
            <p className="mb-2">
              Approve this schema check for adding the changes to the list of allowed changes and
              change the status of this schema check to successful.
            </p>
            <h6 className="mb-1 font-bold">Conditional Breaking Changes</h6>
            <p>
              Configure conditional breaking changes, to automatically mark breaking changes as safe
              based on live usage data collected from your GraphQL Gateway.
            </p>
          </div>
        }
      />
    </>
  );
};

const PolicyInfo = () => {
  return (
    <Popover
      trigger={
        <button type="button" aria-label="About policy line numbers">
          <InfoIcon className="h-3 w-3" />
        </button>
      }
      openOnHover
      width="lg"
      content={
        <p className="text-xs text-fg-default">
          Schema policy checks run on the composed API schema. Line numbers reflect that and will
          not match the lines from the source schema.
        </p>
      }
    />
  );
};

const PolicyBlock = (props: {
  title: string;
  policies: FragmentType<typeof SchemaPolicyEditor_PolicyWarningsFragment>;
  type: 'warning' | 'error';
  goToline?: (line: number | undefined) => void;
}) => {
  const policies = useFragment(SchemaPolicyEditor_PolicyWarningsFragment, props.policies);
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="font-bold text-fg-default">{props.title}</h2>
        <PolicyInfo />
      </div>
      <ul className="list-inside list-disc pl-3 text-sm/relaxed">
        {policies.edges.map((edge, key) => (
          <li
            key={key}
            className={cn(props.type === 'warning' ? 'text-warning' : 'text-critical', 'my-1')}
          >
            <span className="text-left text-fg-secondary">
              {labelize(edge.node.message.replace(/\.$/, ''))}{' '}
            </span>
            {edge.node.start?.line ? (
              <span
                className="ml-1 cursor-default text-xs text-fg-muted hover:underline"
                onClick={() => props.goToline?.(edge.node.start?.line || undefined)}
              >
                on line {edge.node.start.line}
              </span>
            ) : null}
            <Popover
              trigger={
                <button
                  type="button"
                  aria-label="Which rule"
                  className="ml-2 inline-block text-fg-subtle"
                >
                  <CircleQuestionMarkIcon size={16} />
                </button>
              }
              openOnHover
              width="auto"
              content={
                <p className="text-sm text-fg-default">
                  rule: <span className="text-fg">{edge.node.ruleId}</span>
                </p>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

const ConditionalBreakingChangesMetadataSection_SchemaCheckFragment = graphql(`
  fragment ConditionalBreakingChangesMetadataSection_SchemaCheckFragment on SchemaCheck {
    id
    conditionalBreakingChangeMetadata {
      period {
        from
        to
      }
      settings {
        retentionInDays
        percentage
        excludedClientNames
        targets {
          id
          slug
          target {
            id
          }
        }
      }
      usage {
        totalRequestCountFormatted
      }
    }
  }
`);

function ConditionalBreakingChangesMetadataSection(props: {
  schemaCheck: FragmentType<typeof ConditionalBreakingChangesMetadataSection_SchemaCheckFragment>;
}) {
  const schemaCheck = useFragment(
    ConditionalBreakingChangesMetadataSection_SchemaCheckFragment,
    props.schemaCheck,
  );

  if (!schemaCheck.conditionalBreakingChangeMetadata) {
    return (
      <div className="mt-10 mb-5 text-sm text-fg-secondary">
        Get more out of schema checks by enabling conditional breaking changes based on usage data.
        <br />
        <DocsLink
          href="/schema-registry/management/targets#conditional-breaking-changes"
          text="Learn more about conditional breaking changes."
        />
      </div>
    );
  }

  const numberOfTargets = schemaCheck.conditionalBreakingChangeMetadata.settings.targets.length;
  const truncatedTargets = schemaCheck.conditionalBreakingChangeMetadata.settings.targets.slice(
    0,
    3,
  );
  const excludedTargets = schemaCheck.conditionalBreakingChangeMetadata.settings.targets.slice(3);
  const allTargets = schemaCheck.conditionalBreakingChangeMetadata.settings.targets;

  return (
    <div className="mt-10 mb-5 text-sm text-fg-secondary">
      <p>
        Based on{' '}
        <span className="text-fg">
          {schemaCheck.conditionalBreakingChangeMetadata.usage.totalRequestCountFormatted} requests
        </span>{' '}
        from target
        {numberOfTargets === 1 ? '' : 's'}{' '}
        {numberOfTargets <= 3 && (
          <>
            {allTargets.map((target, index) => (
              <Fragment key={target.slug}>
                <span className="text-fg">{target.slug}</span>
                {index === allTargets.length - 1 ? null : ', '}
              </Fragment>
            ))}
          </>
        )}
        {numberOfTargets > 3 && (
          <>
            {truncatedTargets.map((target, index) => (
              <Fragment key={target.slug}>
                <span className="text-fg">{target.slug}</span>
                {index === truncatedTargets.length - 1 ? null : ', '}
              </Fragment>
            ))}
            {' and '}
            <Popover
              trigger={<Button variant="link">{excludedTargets.length} more</Button>}
              content={
                <div className="p-2">
                  <h4 className="mb-2 text-sm font-semibold text-fg">All Targets</h4>
                  <ScrollArea height="sm">
                    <div className="grid grid-cols-1 divide-y divide-line">
                      {allTargets.map((target, index) => (
                        <div key={index} className="py-2">
                          <div className="line-clamp-3 text-sm text-fg-secondary">
                            {target.slug}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              }
            />
          </>
        )}
        . <br />
        Usage data ranges from{' '}
        <span className="text-fg">
          {format(schemaCheck.conditionalBreakingChangeMetadata.period.from, 'do MMM yyyy HH:mm')}
        </span>{' '}
        to{' '}
        <span className="text-fg">
          {format(schemaCheck.conditionalBreakingChangeMetadata.period.to, 'do MMM yyyy HH:mm')} (
          {format(schemaCheck.conditionalBreakingChangeMetadata.period.to, 'z')})
        </span>{' '}
        (period of {schemaCheck.conditionalBreakingChangeMetadata.settings.retentionInDays} day
        {schemaCheck.conditionalBreakingChangeMetadata.settings.retentionInDays === 1 ? '' : 's'}
        ).
        <br />
        <DocsLink
          href="/schema-registry/management/targets#conditional-breaking-changes"
          text="Learn more about conditional breaking changes."
        />
      </p>
    </div>
  );
}

const DefaultSchemaView_SchemaCheckFragment = graphql(`
  fragment DefaultSchemaView_SchemaCheckFragment on SchemaCheck {
    id
    schemaSDL
    serviceName
    hasSchemaCompositionErrors
    baseline {
      sdl
      publicSdl
      supergraphSdl
      compositionErrors {
        message
      }
      meta {
        commit
      }
    }
    meta {
      commit
    }
    ... on SuccessfulSchemaCheck {
      compositeSchemaSDL
      supergraphSDL
    }
    ... on FailedSchemaCheck {
      compositeSchemaSDL
      supergraphSDL
      compositionErrors {
        ...CompositionErrorsSection_SchemaErrorConnection
      }
    }
    breakingSchemaChanges {
      edges {
        node {
          ...ChangesBlock_SchemaChangeWithUsageFragment
        }
      }
    }
    safeSchemaChanges {
      edges {
        node {
          ...ChangesBlock_SchemaChangeFragment
        }
      }
    }
    schemaPolicyWarnings {
      ...SchemaPolicyEditor_PolicyWarningsFragment
      edges {
        node {
          message
        }
      }
    }
    schemaPolicyErrors {
      ...SchemaPolicyEditor_PolicyWarningsFragment
      edges {
        node {
          message
        }
      }
    }
    contractChecks {
      edges {
        node {
          id
          isSuccess
        }
      }
    }
    conditionalBreakingChangeMetadata {
      ...ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
    }
    ...ConditionalBreakingChangesMetadataSection_SchemaCheckFragment
  }
`);

/** The tabs of one view under the contract picker, and which of them is open. */
type CheckView = {
  items: TabbedViewItem[];
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * The default graph's tabs. A hook rather than a component so the page renders one TabbedView
 * whichever graph is picked: switching the picker between the default graph and a contract
 * then swaps the tabs, not the band the picker sits in, and the picker keeps focus.
 */
function useDefaultSchemaView(props: {
  schemaCheck: FragmentType<typeof DefaultSchemaView_SchemaCheckFragment>;
  projectType: ProjectType;
}): CheckView {
  const schemaCheck = useFragment(DefaultSchemaView_SchemaCheckFragment, props.schemaCheck);
  const [selectedView, setSelectedView] = useState<string>('details');
  const [scrollToLine, setScrollToLine] = useState<number | undefined>();

  const items: TabbedViewItem[] = [
    {
      value: 'details',
      label: 'Details',
      icon: ListIcon,
      attrs: { 'data-testid': 'details-view-btn' },
      content: (
        <div className="p-5">
          {!schemaCheck.schemaPolicyWarnings?.edges?.length &&
            !schemaCheck.safeSchemaChanges?.edges?.length &&
            !schemaCheck.breakingSchemaChanges?.edges?.length &&
            !schemaCheck.schemaPolicyErrors?.edges?.length &&
            !schemaCheck.hasSchemaCompositionErrors &&
            !schemaCheck.baseline?.compositionErrors?.length && <NoGraphChanges />}
          {schemaCheck.baseline?.compositionErrors?.length ? (
            <CompositionErrorsList
              title="Baseline Composition Errors"
              description="The supplied baseline could not be composed, no schema diff could be performed."
              errors={schemaCheck.baseline.compositionErrors}
            />
          ) : null}
          {schemaCheck.__typename === 'FailedSchemaCheck' && schemaCheck.compositionErrors && (
            <CompositionErrorsSection compositionErrors={schemaCheck.compositionErrors} />
          )}
          {schemaCheck.breakingSchemaChanges?.edges.length ? (
            <div className="mb-5">
              <ChangesBlock
                schemaCheckId={schemaCheck.id}
                title={<BreakingChangesTitle />}
                changesWithUsage={schemaCheck.breakingSchemaChanges.edges.map(edge => edge.node)}
                conditionBreakingChangeMetadata={schemaCheck.conditionalBreakingChangeMetadata}
              />
            </div>
          ) : null}
          {schemaCheck.safeSchemaChanges ? (
            <div className="mb-5">
              <ChangesBlock
                schemaCheckId={schemaCheck.id}
                title="Safe Changes"
                changes={schemaCheck.safeSchemaChanges.edges.map(edge => edge.node)}
              />
            </div>
          ) : null}
          {schemaCheck.schemaPolicyErrors?.edges.length ? (
            <div className="mb-5">
              <PolicyBlock
                title="Schema Policy Errors"
                policies={schemaCheck.schemaPolicyErrors}
                type="error"
              />
            </div>
          ) : null}
          {schemaCheck.schemaPolicyWarnings ? (
            <div className="mb-5">
              <PolicyBlock
                title="Schema Policy Warnings"
                policies={schemaCheck.schemaPolicyWarnings}
                type="warning"
                goToline={line => {
                  setScrollToLine(Math.max((line ?? 0) - 1, 0));
                  setSelectedView('policy');
                }}
              />
            </div>
          ) : null}
          <ConditionalBreakingChangesMetadataSection schemaCheck={schemaCheck} />
        </div>
      ),
    },
  ];

  if (schemaCheck.serviceName) {
    items.push({
      value: 'service',
      label: 'Service',
      icon: FileDiffIcon,
      attrs: { 'data-testid': 'service-view-btn' },
      content:
        schemaCheck.baseline?.sdl === schemaCheck.schemaSDL ? (
          <SDLSingleView
            sdl={schemaCheck.schemaSDL}
            downloadFileName="service.graphqls"
            title={
              schemaCheck.serviceName ? (
                <span className="flex items-center gap-1">
                  {schemaCheck.baseline?.meta ? (
                    <>
                      <span className="font-mono" data-testid="schema-title-before">
                        {schemaCheck.serviceName}@
                        {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                      </span>
                      <ArrowRight className="inline size-3" />
                    </>
                  ) : null}
                  <span className="font-mono" data-testid="schema-title">
                    {schemaCheck.serviceName}@
                    {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                  </span>
                  <span data-testid="schema-title-changed">(unchanged)</span>
                </span>
              ) : undefined
            }
          />
        ) : (
          <SDLSingleDiffToggleView
            title={
              schemaCheck.serviceName ? (
                <span className="flex items-center gap-1">
                  {schemaCheck.baseline?.meta ? (
                    <>
                      <span className="font-mono">
                        {schemaCheck.serviceName}@
                        {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                      </span>
                      <ArrowRight className="inline size-3" />
                    </>
                  ) : null}
                  <span className="font-mono">
                    {schemaCheck.serviceName}@
                    {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                  </span>
                </span>
              ) : undefined
            }
            before={schemaCheck.baseline?.sdl ?? null}
            after={schemaCheck.schemaSDL}
            downloadFileName="service.graphqls"
          />
        ),
    });
  }

  items.push({
    value: 'schema',
    label: 'Public Schema',
    icon: FileDiffIcon,
    attrs: { 'data-testid': 'schema-view-btn' },
    disabled: !schemaCheck.compositeSchemaSDL,
    tooltip: schemaCheck.compositeSchemaSDL
      ? undefined
      : 'Composition did not succeed. No public schema SDL available.',
    content:
      schemaCheck.baseline?.publicSdl === schemaCheck.compositeSchemaSDL ? (
        <SDLSingleView
          sdl={schemaCheck.schemaSDL}
          downloadFileName="schema.graphqls"
          title={
            schemaCheck.serviceName ? (
              <span className="flex items-center gap-1">
                {schemaCheck.baseline?.meta ? (
                  <>
                    <span className="font-mono" data-testid="schema-title-before">
                      schema@
                      {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                    </span>
                    <ArrowRight className="inline size-3" />
                  </>
                ) : null}
                <span className="font-mono" data-testid="schema-title">
                  schema@
                  {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                </span>
                <span data-testid="schema-title-changed">(unchanged)</span>
              </span>
            ) : undefined
          }
        />
      ) : (
        <SDLSingleDiffToggleView
          before={schemaCheck.baseline?.publicSdl ?? null}
          after={schemaCheck.compositeSchemaSDL ?? null}
          downloadFileName="schema.graphqls"
        />
      ),
  });

  if (props.projectType === ProjectType.Federation) {
    items.push({
      value: 'supergraph',
      label: 'Supergraph',
      icon: FileDiffIcon,
      attrs: { 'data-testid': 'supergraph-view-btn' },
      disabled: !schemaCheck.supergraphSDL,
      tooltip: schemaCheck.supergraphSDL
        ? undefined
        : 'Composition did not succeed. No Supergraph available.',
      content:
        schemaCheck?.baseline?.supergraphSdl === schemaCheck.supergraphSDL ? (
          <SDLSingleView
            sdl={schemaCheck?.baseline?.supergraphSdl ?? ''}
            downloadFileName="supergraph.graphqls"
            title={
              schemaCheck.serviceName ? (
                <span className="flex items-center gap-1">
                  {schemaCheck.baseline?.meta ? (
                    <>
                      <span className="font-mono" data-testid="schema-title-before">
                        supergraph@
                        {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                      </span>
                      <ArrowRight className="inline size-3" />
                    </>
                  ) : null}
                  <span className="font-mono" data-testid="schema-title">
                    supergraph@
                    {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                  </span>
                  <span data-testid="schema-title-changed">(unchanged)</span>
                </span>
              ) : undefined
            }
          />
        ) : (
          <SDLSingleDiffToggleView
            before={schemaCheck?.baseline?.supergraphSdl ?? null}
            after={schemaCheck?.supergraphSDL ?? null}
            downloadFileName="supergraph.graphqls"
          />
        ),
    });
  }

  items.push({
    value: 'policy',
    label: 'Policy',
    icon: TriangleAlertIcon,
    attrs: { 'data-testid': 'policy-view-btn' },
    disabled:
      !schemaCheck.schemaPolicyWarnings &&
      !(
        schemaCheck.__typename === 'FailedSchemaCheck' &&
        schemaCheck.schemaPolicyErrors?.edges?.length
      ),
    content: (
      <>
        <div className="px-5 py-3">
          <Heading>Schema Policy</Heading>
        </div>
        <SchemaPolicyEditor
          compositeSchemaSDL={schemaCheck.schemaSDL ?? ''}
          warnings={schemaCheck.schemaPolicyWarnings ?? null}
          errors={('schemaPolicyErrors' in schemaCheck && schemaCheck.schemaPolicyErrors) || null}
          scrollToLine={scrollToLine}
        />
      </>
    ),
  });

  return {
    items,
    value: selectedView,
    onValueChange: value => {
      setScrollToLine(undefined);
      setSelectedView(value);
    },
  };
}

const ContractCheckView_ContractCheckFragment = graphql(`
  fragment ContractCheckView_ContractCheckFragment on ContractCheck {
    id
    schemaCompositionErrors {
      ...CompositionErrorsSection_SchemaErrorConnection
    }
    breakingSchemaChanges {
      edges {
        node {
          ...ChangesBlock_SchemaChangeWithUsageFragment
        }
      }
    }
    safeSchemaChanges {
      edges {
        node {
          ...ChangesBlock_SchemaChangeFragment
        }
      }
    }
    compositeSchemaSDL
    supergraphSDL
    baseline {
      publicSdl
      supergraphSdl
      compositionErrors {
        message
      }
    }
  }
`);

const ContractCheckView_SchemaCheckFragment = graphql(`
  fragment ContractCheckView_SchemaCheckFragment on SchemaCheck {
    id
    serviceName
    meta {
      commit
    }
    baseline {
      meta {
        commit
      }
    }
    ...ConditionalBreakingChangesMetadataSection_SchemaCheckFragment
    conditionalBreakingChangeMetadata {
      ...ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
    }
  }
`);

/** The picked contract's tabs, or null while the default graph is picked. See useDefaultSchemaView. */
function useContractCheckView(props: {
  contractCheck: FragmentType<typeof ContractCheckView_ContractCheckFragment> | null;
  schemaCheck: FragmentType<typeof ContractCheckView_SchemaCheckFragment>;
  projectType: ProjectType;
}): CheckView | null {
  const contractCheck = useFragment(ContractCheckView_ContractCheckFragment, props.contractCheck);
  const schemaCheck = useFragment(ContractCheckView_SchemaCheckFragment, props.schemaCheck);

  // Another contract starts on Details again, since a view can be disabled on one and not the other.
  const [selectedView, setSelectedView] = useResetState<string>(
    () => 'details',
    [contractCheck?.id],
  );

  if (!contractCheck) {
    return null;
  }

  const items: TabbedViewItem[] = [
    {
      value: 'details',
      label: 'Details',
      icon: ListIcon,
      content: (
        <div className="p-5">
          {contractCheck.baseline?.compositionErrors?.length ? (
            <CompositionErrorsList
              title="Baseline Composition Errors"
              description="The supplied contract baseline could not be composed, no schema diff could be performed."
              errors={contractCheck.baseline.compositionErrors}
            />
          ) : null}
          {contractCheck.schemaCompositionErrors && (
            <CompositionErrorsSection compositionErrors={contractCheck.schemaCompositionErrors} />
          )}
          {contractCheck.breakingSchemaChanges?.edges.length && (
            <div className="mb-2">
              <ChangesBlock
                schemaCheckId={schemaCheck.id}
                title={<BreakingChangesTitle />}
                changesWithUsage={contractCheck.breakingSchemaChanges.edges.map(edge => edge.node)}
                conditionBreakingChangeMetadata={schemaCheck.conditionalBreakingChangeMetadata}
              />
            </div>
          )}
          {contractCheck.safeSchemaChanges && (
            <div className="mb-2">
              <ChangesBlock
                schemaCheckId={schemaCheck.id}
                title="Safe Changes"
                changes={contractCheck.safeSchemaChanges.edges.map(edge => edge.node)}
              />
            </div>
          )}
          {!contractCheck.breakingSchemaChanges &&
          !contractCheck.safeSchemaChanges &&
          !contractCheck.schemaCompositionErrors &&
          !contractCheck.baseline?.compositionErrors?.length ? (
            <NoGraphChanges />
          ) : (
            <ConditionalBreakingChangesMetadataSection schemaCheck={schemaCheck} />
          )}
        </div>
      ),
    },
    {
      value: 'schema',
      label: 'Public Schema',
      icon: FileDiffIcon,
      disabled: !contractCheck.compositeSchemaSDL,
      tooltip: contractCheck.compositeSchemaSDL
        ? undefined
        : 'Composition did not succeed. No public schema SDL available.',
      content:
        contractCheck?.baseline?.publicSdl === contractCheck.compositeSchemaSDL ? (
          <SDLSingleView
            sdl={contractCheck.compositeSchemaSDL ?? ''}
            downloadFileName="service.graphqls"
            title={
              schemaCheck.serviceName ? (
                <span className="flex items-center gap-1">
                  {schemaCheck.baseline?.meta ? (
                    <>
                      <span className="font-mono">
                        schema@
                        {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                      </span>
                      <ArrowRight className="inline size-3" />
                    </>
                  ) : null}
                  <span className="font-mono">
                    schema@
                    {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                  </span>
                  (unchanged)
                </span>
              ) : undefined
            }
          />
        ) : (
          <SDLSingleDiffToggleView
            before={contractCheck?.baseline?.publicSdl ?? null}
            after={contractCheck.compositeSchemaSDL ?? null}
            downloadFileName="schema.graphqls"
          />
        ),
    },
  ];

  if (props.projectType === ProjectType.Federation) {
    items.push({
      value: 'supergraph',
      label: 'Supergraph',
      icon: FileDiffIcon,
      disabled: !contractCheck.supergraphSDL,
      tooltip: contractCheck.supergraphSDL
        ? undefined
        : 'Composition did not succeed. No Supergraph available.',
      content:
        contractCheck?.baseline?.supergraphSdl === contractCheck?.supergraphSDL ? (
          <SDLSingleView
            sdl={contractCheck?.supergraphSDL ?? ''}
            downloadFileName="supergraph.graphqls"
            title={
              schemaCheck.serviceName ? (
                <span className="flex items-center gap-1">
                  {schemaCheck.baseline?.meta ? (
                    <>
                      <span className="font-mono">
                        supergraph@
                        {schemaCheck.baseline?.meta.commit?.substring(0, 7) ?? 'unknown'}
                      </span>
                      <ArrowRight className="inline size-3" />
                    </>
                  ) : null}
                  <span className="font-mono">
                    supergraph@
                    {schemaCheck.meta?.commit.substring(0, 7) ?? <>unknown</>}
                  </span>
                  (unchanged)
                </span>
              ) : undefined
            }
          />
        ) : (
          <SDLSingleDiffToggleView
            before={contractCheck?.baseline?.supergraphSdl ?? null}
            after={contractCheck?.supergraphSDL ?? null}
            downloadFileName="supergraph.graphqls"
          />
        ),
    });
  }

  return { items, value: selectedView, onValueChange: setSelectedView };
}

const SchemaPolicyEditor_PolicyWarningsFragment = graphql(`
  fragment SchemaPolicyEditor_PolicyWarningsFragment on SchemaPolicyWarningConnection {
    edges {
      node {
        message
        ruleId
        start {
          line
          column
        }
        end {
          line
          column
        }
      }
    }
  }
`);

const SchemaPolicyEditor = (props: {
  compositeSchemaSDL: string;
  warnings: FragmentType<typeof SchemaPolicyEditor_PolicyWarningsFragment> | null;
  errors: FragmentType<typeof SchemaPolicyEditor_PolicyWarningsFragment> | null;
  scrollToLine?: number;
}) => {
  const warnings = useFragment(SchemaPolicyEditor_PolicyWarningsFragment, props.warnings);
  const errors = useFragment(SchemaPolicyEditor_PolicyWarningsFragment, props.errors);
  return (
    <AnnotatedSDLView
      sdl={props.compositeSchemaSDL}
      annotations={[
        ...(warnings?.edges.map(edge => ({
          start: {
            line: (edge.node.start?.line ?? 0) - 1,
            character: (edge.node.start?.column ?? 0) - 1,
          },
          end: {
            line: (edge.node.end?.line ?? 0) - 1,
            character: (edge.node.end?.column ?? 0) - 1,
          },
          message: edge.node.message,
          severity: 'warning' as const,
        })) ?? []),
        ...(errors?.edges.map(edge => ({
          start: {
            line: (edge.node.start?.line ?? 0) - 1,
            character: (edge.node.start?.column ?? 0) - 1,
          },
          end: {
            line: (edge.node.end?.line ?? 0) - 1,
            character: (edge.node.end?.column ?? 0) - 1,
          },
          lineNumber: edge.node.start?.line ?? 0,
          message: edge.node.message,
          severity: 'error' as const,
        })) ?? []),
      ]}
    />
  );
};

const SchemaChecksView_SchemaCheckFragment = graphql(`
  fragment SchemaCheckView_SchemaCheckFragment on SchemaCheck {
    id
    hasSchemaCompositionErrors
    hasSchemaChanges
    hasUnapprovedBreakingChanges
    contractChecks {
      edges {
        node {
          id
          contractName
          hasSchemaCompositionErrors
          hasUnapprovedBreakingChanges
          hasSchemaChanges
          schemaCompositionErrors {
            edges {
              node {
                message
              }
            }
          }
          breakingSchemaChanges {
            edges {
              node {
                isSafeBasedOnUsage
                approval {
                  __typename
                }
              }
            }
          }
          baseline {
            compositionErrors {
              message
            }
          }
          ...ContractCheckView_ContractCheckFragment
        }
      }
    }
    ...DefaultSchemaView_SchemaCheckFragment
    ...ContractCheckView_SchemaCheckFragment
  }
`);

function SchemaChecksView(props: {
  schemaCheck: FragmentType<typeof SchemaChecksView_SchemaCheckFragment>;
  projectType: ProjectType;
}) {
  const schemaCheck = useFragment(SchemaChecksView_SchemaCheckFragment, props.schemaCheck);

  const [selectedItem, setSelectedItem] = useResetState<string>(() => 'default', [schemaCheck.id]);
  const selectedContractCheckNode = useMemo(
    () =>
      schemaCheck.contractChecks?.edges?.find(edge => edge.node.id === selectedItem)?.node ?? null,
    [selectedItem, schemaCheck],
  );

  const contractChecks = schemaCheck.contractChecks?.edges ?? [];
  // Without contracts there is nothing to pick, but the default graph keeps its status glyph.
  const contractPicker = !contractChecks.length ? (
    <span className="inline-flex items-center gap-1.5 px-2 text-xs text-fg-default">
      {checkStatusIcon(schemaCheck, 'Schema changed')}
      Default Graph
    </span>
  ) : (
    <Select
      aria-label="Contract"
      value={selectedItem}
      onValueChange={setSelectedItem}
      label={
        <span className="inline-flex items-center gap-1.5">
          {selectedContractCheckNode
            ? checkStatus(selectedContractCheckNode, 'Contract schema changed').icon
            : checkStatus(schemaCheck, 'Schema changed').icon}
          {selectedContractCheckNode?.contractName ?? 'Default Graph'}
        </span>
      }
      options={[
        {
          value: 'default',
          label: 'Default Graph',
          trailing: checkStatusIcon(schemaCheck, 'Schema changed'),
        },
        ...contractChecks.map(edge => ({
          value: edge.node.id,
          label: edge.node.contractName,
          trailing: checkStatusIcon(edge.node, 'Contract schema changed'),
        })),
      ]}
      size="compact"
      width="auto"
    />
  );

  const failures = contractChecks.flatMap(edge => {
    const failure = contractFailure(edge.node);
    return failure
      ? [
          {
            key: edge.node.id,
            label: edge.node.contractName,
            ...failure,
            onView: () => setSelectedItem(edge.node.id),
          },
        ]
      : [];
  });

  const defaultView = useDefaultSchemaView({
    schemaCheck,
    projectType: props.projectType,
  });
  const contractView = useContractCheckView({
    contractCheck: selectedContractCheckNode,
    schemaCheck,
    projectType: props.projectType,
  });
  const active = contractView ?? defaultView;
  // The picker opens on the default graph, so a contract that failed is named here first.
  return (
    <div className="mt-3 flex flex-col gap-3">
      {failures.length ? (
        <div className="mb-3">
          <FailureCard
            title={`${failures.length} of ${contractChecks.length} contracts failed`}
            aside={`${contractChecks.length - failures.length} passed`}
            items={failures}
          />
        </div>
      ) : null}
      <ScopeBar
        picker={contractPicker}
        legend={contractChecks.length ? CONTRACT_STATUS_LEGEND : undefined}
      />
      <TabbedView
        items={active.items}
        value={active.value}
        onValueChange={active.onValueChange}
        bodyPadding="none"
      />
    </div>
  );
}

const CONTRACT_STATUS_LEGEND = [
  { icon: <TriangleAlertIcon className="size-3.5 text-critical" />, label: 'Failed' },
  { icon: <GitCompareIcon className="size-3.5" />, label: 'Schema changed' },
  { icon: <CheckIcon className="size-3.5 text-success" />, label: 'Passed' },
];

/**
 * Why a contract check failed, in the CLI's words, with how much it found. A contract fails to
 * compose or fails its diff, never both: no diff runs after a composition failure. A baseline that
 * failed to compose sets neither flag, so it is the third case.
 */
function contractFailure(check: {
  hasSchemaCompositionErrors: boolean;
  hasUnapprovedBreakingChanges: boolean;
  schemaCompositionErrors: { edges: ReadonlyArray<unknown> } | null;
  breakingSchemaChanges: {
    edges: ReadonlyArray<{ node: { isSafeBasedOnUsage: boolean; approval: unknown } }>;
  } | null;
  baseline: { compositionErrors: ReadonlyArray<unknown> | null } | null;
}): { reason: string; detail?: string } | null {
  if (check.hasSchemaCompositionErrors) {
    const count = check.schemaCompositionErrors?.edges.length ?? 0;
    return {
      reason: 'Composition failed.',
      detail: count ? formatCount(count, 'error') : undefined,
    };
  }
  if (check.hasUnapprovedBreakingChanges) {
    const count =
      check.breakingSchemaChanges?.edges.filter(
        edge => edge.node.approval == null && !edge.node.isSafeBasedOnUsage,
      ).length ?? 0;
    return {
      reason: 'Unapproved breaking changes!',
      detail: count ? formatCount(count, 'breaking change') : undefined,
    };
  }
  const baselineErrors = check.baseline?.compositionErrors?.length ?? 0;
  if (baselineErrors) {
    return { reason: 'Baseline composition failed.', detail: formatCount(baselineErrors, 'error') };
  }
  return null;
}

type CheckStatusFlags = {
  hasSchemaCompositionErrors: boolean;
  hasUnapprovedBreakingChanges: boolean;
  hasSchemaChanges: boolean;
  /** Only a contract check has one; a failed baseline sets neither flag above. */
  baseline?: { compositionErrors: ReadonlyArray<unknown> | null } | null;
};

/** The glyph and the words for a check's outcome; the trigger takes the glyph, the list both. */
function checkStatus(check: CheckStatusFlags, changedLabel: string) {
  if (check.hasSchemaCompositionErrors) {
    return {
      icon: <TriangleAlertIcon className="size-3.5 text-critical" />,
      label: 'Composition failed.',
    };
  }
  if (check.hasUnapprovedBreakingChanges) {
    return {
      icon: <TriangleAlertIcon className="size-3.5 text-critical" />,
      label: 'Unapproved breaking changes!',
    };
  }
  if (check.baseline?.compositionErrors?.length) {
    return {
      icon: <TriangleAlertIcon className="size-3.5 text-critical" />,
      label: 'Baseline composition failed.',
    };
  }
  if (check.hasSchemaChanges) {
    return { icon: <GitCompareIcon className="size-3.5" />, label: changedLabel };
  }
  return {
    icon: <CheckIcon className="size-3.5 text-success" />,
    label: 'Composition succeeded.',
  };
}

function checkStatusIcon(check: CheckStatusFlags, changedLabel: string) {
  const status = checkStatus(check, changedLabel);
  return <StatusTooltip icon={status.icon} label={status.label} />;
}

const ActiveSchemaCheck_SchemaCheckFragment = graphql(`
  fragment ActiveSchemaCheck_SchemaCheckFragment on SchemaCheck {
    __typename
    id
    serviceName
    contextId
    createdAt
    meta {
      commit
      author
    }
    ... on FailedSchemaCheck {
      canBeApproved
      canBeApprovedByViewer
    }
    ... on SuccessfulSchemaCheck {
      isApproved
      approvedBy {
        id
        displayName
        email
      }
      cliApprovalMetadata {
        displayName
        email
      }
      approvalComment
    }
    contractChecks {
      __typename
      edges {
        node {
          id
          isSuccess
        }
      }
    }
    ...SchemaCheckView_SchemaCheckFragment
  }
`);

export const ActiveSchemaCheckQuery = graphql(`
  query ActiveSchemaCheck_ActiveSchemaCheckQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $schemaCheckId: ID!
  ) {
    project(
      reference: { bySelector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug } }
    ) {
      id
      type
      target: targetBySlug(targetSlug: $targetSlug) {
        id
        schemaCheck(id: $schemaCheckId) {
          ...ActiveSchemaCheck_SchemaCheckFragment
        }
      }
    }
  }
`);

const ActiveSchemaCheck = (props: { schemaCheckId: string | null }): React.ReactElement | null => {
  const { schemaCheckId } = props;
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: ActiveSchemaCheckQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
      schemaCheckId: schemaCheckId ?? '',
    },
    pause: !schemaCheckId,
  });
  const [approvalOpen, setApprovalOpen] = useState(false);

  const schemaCheck = useFragment(
    ActiveSchemaCheck_SchemaCheckFragment,
    query.data?.project?.target?.schemaCheck,
  );

  if (!schemaCheckId) {
    return null;
  }

  if (query.fetching || query.stale) {
    return (
      <div className="flex h-fit flex-1 items-center justify-center self-center">
        <div className="flex flex-col items-center text-sm text-fg-secondary">
          <span className="mb-3">
            <Spinner variants={{ size: 'lg' }} />
          </span>
          Loading Schema Check...
        </div>
      </div>
    );
  }

  if (query.error) {
    return (
      <QueryError
        organizationSlug={organizationSlug}
        error={query.error}
        showLogoutButton={false}
      />
    );
  }

  if (!schemaCheck || !query.data?.project) {
    return (
      <EmptyList
        className="border-0"
        title="Check not found"
        description="Learn how to check your schema with Hive CLI"
        docsUrl="/schema-registry#check-a-schema"
      />
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="py-6">
        <Title>Check {schemaCheck.id}</Title>
        <Subtitle>Detailed view of the schema check</Subtitle>
      </div>
      <div className="mb-3">
        <div className="flex items-center gap-4 rounded-md border bg-surface-card px-5 py-4">
          <div className="min-w-0 flex-1">
            <DescriptionList
              variants={{ termStyle: 'title', columns: 'auto' }}
              rows={[
                {
                  items: [
                    {
                      term: 'Status',
                      description:
                        schemaCheck.__typename === 'FailedSchemaCheck' ? (
                          <span className="text-critical">Failed</span>
                        ) : (
                          'Success'
                        ),
                    },
                    ...(schemaCheck.serviceName
                      ? [
                          {
                            term: 'Service',
                            description: (
                              <ServiceFilterButton serviceName={schemaCheck.serviceName} />
                            ),
                          },
                        ]
                      : []),
                    {
                      term: 'Triggered',
                      description: (
                        <>
                          <TimeAgo date={schemaCheck.createdAt} />
                          {schemaCheck.meta?.author ? <> by {schemaCheck.meta.author}</> : null}
                        </>
                      ),
                    },
                    ...(schemaCheck.meta?.commit
                      ? [
                          {
                            term: 'Commit',
                            description: (
                              <CopyText>
                                <span title={schemaCheck.meta.commit}>
                                  {schemaCheck.meta.commit}
                                </span>
                              </CopyText>
                            ),
                          },
                        ]
                      : []),
                    ...(schemaCheck.contextId
                      ? [
                          {
                            term: 'Context ID',
                            description: (
                              <CopyText>
                                <span title={schemaCheck.contextId}>{schemaCheck.contextId}</span>
                              </CopyText>
                            ),
                          },
                        ]
                      : []),
                  ],
                },
              ]}
            />
          </div>
          {schemaCheck.__typename === 'FailedSchemaCheck' && schemaCheck.canBeApproved ? (
            <div className="shrink-0">
              {schemaCheck.canBeApprovedByViewer ? (
                <Popover
                  open={approvalOpen}
                  onOpenChange={setApprovalOpen}
                  trigger={
                    <Button variant="destructive" disabled={approvalOpen}>
                      Approve{' '}
                      {approvalOpen ? (
                        <ChevronUp className="ml-2 size-4" />
                      ) : (
                        <ChevronDown className="ml-2 size-4" />
                      )}
                    </Button>
                  }
                  width="lg"
                  align="end"
                  arrow
                  content={
                    <ApproveFailedSchemaCheckModal
                      onClose={() => setApprovalOpen(false)}
                      schemaCheckId={schemaCheck.id}
                      contextId={schemaCheck.contextId}
                    />
                  }
                />
              ) : null}
            </div>
          ) : null}
        </div>
        {schemaCheck.__typename === 'SuccessfulSchemaCheck' && schemaCheck.isApproved ? (
          <div className="py-6">
            <div className="flex flex-row items-center gap-x-6 rounded-md border border-line-subtle p-4 font-medium text-fg-secondary">
              <div>
                <Tooltip
                  trigger={
                    <span className="inline-flex">
                      <BadgeCheck className="size-6 text-success" />
                    </span>
                  }
                  content={
                    <>
                      Schema Check was manually approved by{' '}
                      {schemaCheck.approvedBy?.displayName ??
                        schemaCheck.cliApprovalMetadata?.displayName ??
                        'unknown'}
                      .
                    </>
                  }
                />
              </div>
              <div>
                <p className="text-sm leading-none font-medium">
                  {schemaCheck.approvedBy?.displayName ??
                    schemaCheck.cliApprovalMetadata?.displayName ??
                    'unknown'}
                </p>
                <p className="text-sm text-fg-secondary">
                  {schemaCheck.approvedBy?.email ??
                    schemaCheck.cliApprovalMetadata?.email ??
                    'unknown'}
                </p>
              </div>
              {schemaCheck.approvalComment ? (
                <div className="text-sm text-fg italic">
                  <span>„ </span>
                  {schemaCheck.approvalComment}
                  <span> ”</span>
                </div>
              ) : (
                <div className="text-sm italic">
                  manually approved this schema check without a comment
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <SchemaChecksView schemaCheck={schemaCheck} projectType={query.data.project.type} />
    </div>
  );
};

export function TargetChecksSinglePage(props: { schemaCheckId: string }) {
  return (
    <>
      <Meta title={`Schema check ${props.schemaCheckId}`} />
      <ActiveSchemaCheck schemaCheckId={props.schemaCheckId} />
    </>
  );
}
