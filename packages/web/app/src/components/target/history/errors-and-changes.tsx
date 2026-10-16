import { ReactElement, ReactNode } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ActivityIcon, BoxIcon, CheckIcon, CircleCheckIcon } from 'lucide-react';
import reactStringReplace from 'react-string-replace';
import { BreakingChangeTargets } from '@/components/target/history/breaking-change-targets';
import { CompositionErrorMessage } from '@/components/target/history/composition-error-message';
import { CompositionErrorsPopover } from '@/components/target/history/composition-errors-popover';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { Accordion } from '@/components/ui/primitives/accordion/accordion';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { ScrollArea } from '@/components/ui/primitives/scroll-area/scroll-area';
import { FragmentType, graphql, useFragment, type DocumentType } from '@/gql';
import { SchemaChangeUsageTracking, SeverityLevelType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { formatCount } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

function ChangeBadge({ content }: { content: string }) {
  return <Badge content={content} variants={{ padding: 'tight', variant: 'warning' }} />;
}

export function labelize(message: string) {
  return reactStringReplace(message.replace(/"/g, "'"), /'((?:[^'\\]|\\.)+?)'/g, (match, i) => (
    <ChangeBadge key={i + match} content={match.replace(/\\'/g, "'")} />
  ));
}

// Zero usage only means "safe" where usage is recorded; elsewhere it means nothing was looked at.
const UNTRACKED_USAGE_LABEL: Record<SchemaChangeUsageTracking, string> = {
  [SchemaChangeUsageTracking.Tracked]: 'Safe based on usage data',
  [SchemaChangeUsageTracking.OnReferencingFields]:
    "Usage isn't counted for types, only for the fields that use them.",
  [SchemaChangeUsageTracking.NotTracked]: "Usage isn't tracked for this kind of change",
};

const severityLevelMapping = {
  [SeverityLevelType.Safe]: clsx('text-success'),
  [SeverityLevelType.Dangerous]: clsx('text-warning'),
} as Record<SeverityLevelType, string>;

export const ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment = graphql(`
  fragment ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment on SchemaCheckConditionalBreakingChangeMetadata {
    period {
      from
      to
    }
    settings {
      retentionInDays
      targets {
        id
        slug
        target {
          id
          slug
        }
      }
    }
  }
`);

const ChangesBlock_SchemaChangeApprovalFragment = graphql(`
  fragment ChangesBlock_SchemaChangeApprovalFragment on SchemaChangeApproval {
    approvedBy {
      id
      displayName
    }
    cliApprovalMetadata {
      displayName
      email
    }
    approvedAt
    schemaCheckId
  }
`);

export const ChangesBlock_SchemaChangeWithUsageFragment = graphql(`
  fragment ChangesBlock_SchemaChangeWithUsageFragment on SchemaChange {
    path
    message(withSafeBasedOnUsageNote: false)
    severityLevel
    severityReason
    approval {
      ...ChangesBlock_SchemaChangeApprovalFragment
    }
    isSafeBasedOnUsage
    usageTracking
    usageStatistics {
      topAffectedOperations {
        hash
        name
        countFormatted
        percentageFormatted
        affectedTargets {
          target {
            id
            slug
          }
        }
      }
      topAffectedClients {
        name
        countFormatted
        percentageFormatted
      }
      affectedTargets {
        target {
          id
          slug
          target {
            id
            slug
          }
        }
        count
        countFormatted
        operationCount
      }
      schemaCoordinate
    }
    affectedAppDeployments(first: 5) {
      edges {
        cursor
        node {
          id
          name
          version
          activatedAt
          lastUsed
          affectedOperations(first: 5) {
            edges {
              cursor
              node {
                hash
                name
              }
            }
          }
          totalAffectedOperations
        }
      }
      totalCount
    }
  }
`);

export const ChangesBlock_SchemaChangeFragment = graphql(`
  fragment ChangesBlock_SchemaChangeFragment on SchemaChange {
    path
    message(withSafeBasedOnUsageNote: false)
    severityLevel
    severityReason
    approval {
      ...ChangesBlock_SchemaChangeApprovalFragment
    }
    isSafeBasedOnUsage
    usageTracking
  }
`);

type ChangeWithUsage = DocumentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>;
type UsageStatistics = NonNullable<ChangeWithUsage['usageStatistics']>;
type AffectedOperation = UsageStatistics['topAffectedOperations'][number];
type AffectedClient = UsageStatistics['topAffectedClients'][number];
type AffectedDeploymentConnection = NonNullable<ChangeWithUsage['affectedAppDeployments']>;
type AffectedDeployment = AffectedDeploymentConnection['edges'][number]['node'];
type InsightsTarget = DocumentType<
  typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
>['settings']['targets'][number];

export function ChangesBlock(
  props: {
    title?: string | React.ReactElement;
    /** The check being viewed, when there is one: a schema version shows the same changes without. */
    schemaCheckId?: string;
    conditionBreakingChangeMetadata?: FragmentType<
      typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
    > | null;
  } & (
    | {
        changesWithUsage: FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>[];
        changes?: undefined;
      }
    | {
        changes: FragmentType<typeof ChangesBlock_SchemaChangeFragment>[];
        changesWithUsage?: undefined;
      }
  ),
): ReactElement | null {
  const withUsage = useFragment(ChangesBlock_SchemaChangeWithUsageFragment, props.changesWithUsage);
  const plain = useFragment(ChangesBlock_SchemaChangeFragment, props.changes);
  const keys = rowKeys(
    (withUsage ?? plain ?? []).map(change => `${change.path?.join('.') ?? ''}:${change.message}`),
  );
  return (
    <div>
      {props.title && <ChangesTitle>{props.title}</ChangesTitle>}
      <div
        className={clsx(
          'text-sm/relaxed',
          props.changesWithUsage ? 'flex flex-col gap-4' : 'list-inside list-disc space-y-2',
        )}
      >
        {props.changesWithUsage?.map((change, index) => (
          <ChangeItem
            schemaCheckId={props.schemaCheckId}
            key={keys[index]}
            change={null}
            changeWithUsage={change}
            conditionBreakingChangeMetadata={props.conditionBreakingChangeMetadata ?? null}
          />
        ))}
        {props.changes?.map((change, index) => (
          <ChangeItem
            schemaCheckId={props.schemaCheckId}
            key={keys[index]}
            change={change}
            changeWithUsage={null}
            conditionBreakingChangeMetadata={props.conditionBreakingChangeMetadata ?? null}
          />
        ))}
      </div>
    </div>
  );
}

export function ChangesTitle(props: { children: ReactNode; 'data-cy'?: string }) {
  return (
    <h2 className="mb-3 text-base font-bold text-fg" data-cy={props['data-cy']}>
      {props.children}
    </h2>
  );
}

/**
 * Keys rows by change, not position: each row's accordion owns its open state, so a positional key
 * would leave "row 3 open" on whatever change a new page or filter puts third. A change is its
 * coordinate and message; an exact repeat falls back to its position rather than colliding.
 */
function rowKeys(ids: ReadonlyArray<string | null | undefined>) {
  const seen = new Set<string>();
  return ids.map((id, index) => {
    if (!id || seen.has(id)) {
      return `${id ?? 'change'}:${index}`;
    }
    seen.add(id);
    return id;
  });
}

function ChangeItem(
  props: {
    conditionBreakingChangeMetadata: FragmentType<
      typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
    > | null;
    schemaCheckId?: string;
  } & (
    | {
        change: FragmentType<typeof ChangesBlock_SchemaChangeFragment>;
        changeWithUsage: null;
      }
    | {
        change: null;
        changeWithUsage: FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>;
      }
  ),
) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  const cchange = useFragment(ChangesBlock_SchemaChangeFragment, props.change);
  const cchangeWithUsage = useFragment(
    ChangesBlock_SchemaChangeWithUsageFragment,
    props.changeWithUsage,
  );

  // at least one prop must be provided :)
  const change = (cchange ?? cchangeWithUsage)!;

  const metadata = useFragment(
    ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
    props.conditionBreakingChangeMetadata,
  );

  const usageStatistics = 'usageStatistics' in change ? (change.usageStatistics ?? null) : null;

  // Older checks have no per-target counts and keep the old layout.
  const targetUsage =
    'usageStatistics' in change &&
    !change.isSafeBasedOnUsage &&
    change.usageStatistics?.affectedTargets?.length &&
    metadata
      ? {
          statistics: change.usageStatistics,
          affectedTargets: change.usageStatistics.affectedTargets,
          coordinate: change.usageStatistics.schemaCoordinate ?? change.path!.join('.'),
          metadata,
        }
      : null;

  // Null when there is nothing to show, which makes the row static rather than open to nothing.
  const details = targetUsage ? (
    <>
      <BreakingChangeTargets
        affectedTargets={targetUsage.affectedTargets}
        targets={targetUsage.metadata.settings.targets}
        coordinate={targetUsage.coordinate}
        period={targetUsage.metadata.period}
      />
      <section className="space-y-2">
        <h4 className="text-sm font-medium text-fg">Affected operations and clients</h4>
        <UsageStatisticsPanels
          usageStatistics={targetUsage.statistics}
          targets={targetUsage.metadata.settings.targets}
          period={targetUsage.metadata.period}
          withTargets
        />
      </section>
      {props.schemaCheckId &&
      'affectedAppDeployments' in change &&
      change.affectedAppDeployments?.edges?.length ? (
        <AffectedAppDeploymentsPanel
          schemaCheckId={props.schemaCheckId}
          coordinate={change.path?.join('.')}
          connection={change.affectedAppDeployments}
        />
      ) : null}
    </>
  ) : 'usageStatistics' in change && change.usageStatistics && metadata ? (
    <div>
      <h4 className="mb-1 text-sm font-medium text-fg">Affected Operations (based on usage)</h4>
      <div className="mb-2 flex justify-between text-sm text-fg-secondary">
        <span>Top 10 operations and clients affected by this change based on usage data.</span>
        {metadata && (
          <span className="text-xs text-fg-default">
            See{' '}
            {metadata.settings.targets.map((target, index, arr) => (
              <>
                {!target.target ? (
                  <Tooltip
                    key={index}
                    trigger={target.slug}
                    content="Target does no longer exist."
                  />
                ) : (
                  <Link
                    key={index}
                    preload={false}
                    className="text-accent-muted hover:text-accent"
                    to="/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate"
                    params={{
                      organizationSlug,
                      projectSlug,
                      targetSlug: target.target.slug,
                      coordinate: change.path!.join('.'),
                    }}
                    search={{ from: metadata.period.from, to: metadata.period.to }}
                    target="_blank"
                  >
                    {target.slug}
                  </Link>
                )}
                {index === arr.length - 1 ? null : index === arr.length - 2 ? ' and ' : ', '}
              </>
            ))}{' '}
            target insights for live usage data.
          </span>
        )}
      </div>
      <UsageStatisticsPanels
        usageStatistics={change.usageStatistics}
        targets={metadata.settings.targets}
        period={metadata.period}
      />
      {props.schemaCheckId &&
      'affectedAppDeployments' in change &&
      change.affectedAppDeployments?.edges?.length ? (
        <div className="mt-6">
          <AffectedAppDeploymentsPanel
            schemaCheckId={props.schemaCheckId}
            coordinate={change.path?.join('.')}
            connection={change.affectedAppDeployments}
          />
        </div>
      ) : null}
    </div>
  ) : props.schemaCheckId &&
    'affectedAppDeployments' in change &&
    change.affectedAppDeployments?.edges?.length ? (
    <AffectedAppDeploymentsPanel
      schemaCheckId={props.schemaCheckId}
      coordinate={change.path?.join('.')}
      connection={change.affectedAppDeployments}
    />
  ) : change.severityReason ? (
    <>{change.severityReason}</>
  ) : null;

  return (
    <Accordion
      variant={props.changeWithUsage ? 'boxed' : 'list'}
      items={[
        {
          value: 'item-1',
          label: (
            <div
              className={clsx(
                'text-left',
                (change.approval && 'text-accent') ||
                  (severityLevelMapping[change.severityLevel] ?? 'text-critical'),
              )}
            >
              <div>
                <span className="text-fg-secondary">{labelize(change.message)}</span>
                {'affectedAppDeployments' in change && change.affectedAppDeployments?.totalCount ? (
                  <>
                    {' '}
                    <span className="inline-flex items-center space-x-1 rounded-sm bg-warning px-2 py-1 align-middle font-bold text-fg-inverse">
                      <BoxIcon className="size-4 stroke-[2px]" />
                      <span className="text-xs">
                        {change.affectedAppDeployments.totalCount}{' '}
                        {change.affectedAppDeployments.totalCount === 1
                          ? 'app deployment'
                          : 'app deployments'}{' '}
                        affected
                      </span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          ),
          trailing:
            change.isSafeBasedOnUsage || usageStatistics || change.approval ? (
              <span className="flex items-center gap-2">
                {change.isSafeBasedOnUsage ? (
                  change.usageTracking === SchemaChangeUsageTracking.Tracked ? (
                    <Badge
                      icon={CheckIcon}
                      content="Safe based on usage data"
                      variants={{ variant: 'warning' }}
                    />
                  ) : (
                    <Badge
                      content={UNTRACKED_USAGE_LABEL[change.usageTracking]}
                      variants={{ variant: 'secondary' }}
                    />
                  )
                ) : null}
                {usageStatistics ? (
                  <Badge
                    icon={ActivityIcon}
                    content={`${formatCount(
                      usageStatistics.topAffectedOperations.length,
                      'operation',
                      // Ten is the cap, so ten means at least ten.
                      usageStatistics.topAffectedOperations.length >= 10 ? '10+' : undefined,
                    )} by ${formatCount(usageStatistics.topAffectedClients.length, 'client')} affected`}
                    variants={{ variant: 'critical' }}
                  />
                ) : null}
                {change.approval ? <ApprovedByBadge approval={change.approval} /> : null}
              </span>
            ) : undefined,
          content:
            change.approval || details ? (
              <div
                className={
                  targetUsage ? 'space-y-5' : props.changeWithUsage ? undefined : 'pt-4 pb-4'
                }
              >
                {change.approval && (
                  <SchemaChangeApproval
                    schemaCheckId={props.schemaCheckId}
                    approval={change.approval}
                  />
                )}
                {details}
              </div>
            ) : null,
        },
      ]}
    />
  );
}

function trafficColumns<
  TRow extends { countFormatted: string; percentageFormatted: string },
>(): ColumnDef<TRow, unknown>[] {
  return [
    {
      id: 'count',
      header: 'Total Requests',
      meta: { align: 'right', width: 'sm' },
      cell: ({ row }) => <DataTableCell kind="number" value={row.original.countFormatted} />,
    },
    {
      id: 'share',
      header: '% of traffic',
      meta: { align: 'right', width: 'sm' },
      cell: ({ row }) => <DataTableCell kind="number" value={row.original.percentageFormatted} />,
    },
  ];
}

function UsageStatisticsPanels(props: {
  usageStatistics: UsageStatistics;
  targets: InsightsTarget[];
  period: { from: string; to: string };
  /** The targets table links to Insights; operation rows only say where they ran. */
  withTargets?: boolean;
}) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  const operationColumns: ColumnDef<AffectedOperation, unknown>[] = [
    {
      id: 'name',
      header: 'Operation Name',
      meta: { width: 'fill' },
      cell: ({ row }) => {
        const operationName = `${row.original.hash.substring(0, 4)}_${row.original.name}`;
        if (props.withTargets) {
          return <DataTableCell kind="text" value={operationName} mono />;
        }
        const targets = props.targets.flatMap(target =>
          target.target
            ? [
                {
                  label: target.slug,
                  link: {
                    to: '/$organizationSlug/$projectSlug/$targetSlug/insights/$operationName/$operationHash' as const,
                    params: {
                      organizationSlug,
                      projectSlug,
                      targetSlug: target.target.slug,
                      operationName,
                      operationHash: row.original.hash,
                    },
                    search: { from: props.period.from, to: props.period.to },
                  },
                },
              ]
            : [],
        );
        return targets.length ? (
          <DataTableCell
            kind="link-out"
            label={operationName}
            mono
            targets={targets}
            tooltip="View live usage in Insights"
          />
        ) : (
          <DataTableCell kind="text" value={operationName} mono />
        );
      },
    },
    ...(props.withTargets
      ? [
          {
            id: 'seenIn',
            header: 'Seen in',
            meta: { width: 'md' },
            cell: ({ row }) => (
              <DataTableCell
                kind="text"
                tone="muted"
                value={(row.original.affectedTargets ?? [])
                  .map(affected => affected.target.slug)
                  .join(', ')}
              />
            ),
          } satisfies ColumnDef<AffectedOperation, unknown>,
        ]
      : []),
    ...trafficColumns<AffectedOperation>(),
  ];
  const clientColumns: ColumnDef<AffectedClient, unknown>[] = [
    {
      id: 'name',
      header: 'Client Name',
      meta: { width: 'fill' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.name} weight="medium" />,
    },
    ...trafficColumns<AffectedClient>(),
  ];

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <DataTable
          data={props.usageStatistics.topAffectedOperations}
          columns={operationColumns}
          getRowId={operation => operation.hash}
          pagination={{ kind: 'none' }}
          variants={{ bordered: !!props.withTargets }}
          emptyMessage="No affected operations."
        />
      </div>
      <div className="min-w-0 flex-1">
        <DataTable
          data={props.usageStatistics.topAffectedClients}
          columns={clientColumns}
          getRowId={client => client.name}
          pagination={{ kind: 'none' }}
          variants={{ bordered: !!props.withTargets }}
          emptyMessage="No affected clients."
        />
      </div>
    </div>
  );
}

function AffectedAppDeploymentsPanel(props: {
  schemaCheckId: string;
  coordinate: string | undefined;
  connection: AffectedDeploymentConnection;
}) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const appVersionLink = (deployment: AffectedDeployment) => ({
    to: '/$organizationSlug/$projectSlug/$targetSlug/apps/$appName/$appVersion' as const,
    params: {
      organizationSlug,
      projectSlug,
      targetSlug,
      appName: deployment.name,
      appVersion: deployment.version,
    },
    search: { coordinates: props.coordinate },
  });

  const columns: ColumnDef<AffectedDeployment, unknown>[] = [
    {
      id: 'name',
      header: 'App Name',
      meta: { width: 'md' },
      cell: ({ row }) => (
        <DataTableCell kind="link" label={row.original.name} link={appVersionLink(row.original)} />
      ),
    },
    {
      id: 'version',
      header: 'Version',
      meta: { width: 'fill' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.version} />,
    },
    {
      id: 'activatedAt',
      header: 'Activated',
      cell: ({ row }) =>
        row.original.activatedAt ? (
          <DataTableCell kind="time" date={row.original.activatedAt} mode="relative-info" />
        ) : (
          <DataTableCell kind="placeholder" />
        ),
    },
    {
      id: 'lastUsed',
      header: 'Last Used',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.lastUsed ? (
          <DataTableCell kind="time" date={row.original.lastUsed} mode="relative-info" />
        ) : (
          <DataTableCell kind="placeholder" />
        ),
    },
    {
      id: 'operations',
      header: 'Affected Operations',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const deployment = row.original;
        return (
          <DataTableCell
            kind="text"
            value={
              <Popover
                trigger={
                  <Button variant="link">
                    {deployment.totalAffectedOperations}{' '}
                    {deployment.totalAffectedOperations === 1 ? 'operation' : 'operations'}
                  </Button>
                }
                side="left"
                width="md"
                arrow
                content={
                  <div className="space-y-2">
                    <h5 className="font-medium text-fg">Affected Operations</h5>
                    <ScrollArea maxHeight="sm">
                      <ul className="space-y-1 text-sm">
                        {deployment.affectedOperations.edges.map(({ node: op }) => (
                          <li key={op.hash} className="text-fg-default">
                            {op.name || `[anonymous] (${op.hash.substring(0, 8)}...)`}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                    <Link
                      {...appVersionLink(deployment)}
                      className="block pt-2 text-sm text-accent hover:underline"
                    >
                      Show all ({deployment.totalAffectedOperations}) affected operations
                    </Link>
                  </div>
                }
              />
            }
          />
        );
      },
    },
  ];

  return (
    <div>
      <h4 className="mb-1 text-sm font-medium text-fg">Affected App Deployments</h4>
      <p className="mb-2 text-sm text-fg-secondary">
        Top 5 active app deployments that have operations using this schema coordinate (snapshot
        from when the check was run).
      </p>
      <DataTable
        data={props.connection.edges.map(edge => edge.node)}
        columns={columns}
        getRowId={deployment => deployment.id}
        pagination={{ kind: 'none' }}
      />
      {props.connection.totalCount > 5 && (
        <Link
          to="/$organizationSlug/$projectSlug/$targetSlug/checks/$schemaCheckId/affected-deployments"
          params={{
            organizationSlug,
            projectSlug,
            targetSlug,
            schemaCheckId: props.schemaCheckId,
          }}
          search={{ coordinate: props.coordinate }}
          className="mt-2 block text-sm text-warning hover:underline"
        >
          View all ({props.connection.totalCount}) affected app deployments
        </Link>
      )}
    </div>
  );
}

function ApprovedByBadge(props: {
  approval: FragmentType<typeof ChangesBlock_SchemaChangeApprovalFragment>;
}) {
  const approval = useFragment(ChangesBlock_SchemaChangeApprovalFragment, props.approval);
  const approvalName =
    approval.approvedBy?.displayName ?? approval.cliApprovalMetadata?.displayName ?? '<unknown>';

  return (
    <Badge
      icon={CheckIcon}
      content={`Approved by ${approvalName}`}
      variants={{ variant: 'success' }}
    />
  );
}

function SchemaChangeApproval(props: {
  approval: FragmentType<typeof ChangesBlock_SchemaChangeApprovalFragment>;
  schemaCheckId?: string;
}) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const approval = useFragment(ChangesBlock_SchemaChangeApprovalFragment, props.approval);
  const approvalName =
    approval.approvedBy?.displayName ?? approval.cliApprovalMetadata?.displayName ?? '<unknown>';
  const approvalDate = format(new Date(approval.approvedAt), 'do MMMM yyyy');
  const schemaCheckPath =
    '/' + [organizationSlug, projectSlug, targetSlug, 'checks', approval.schemaCheckId].join('/');

  return (
    <div className="mb-3">
      This breaking change was manually{' '}
      {approval.schemaCheckId === props.schemaCheckId ? (
        <>
          {' '}
          approved by {approvalName} in this schema check on {approvalDate}.
        </>
      ) : (
        <a href={schemaCheckPath} className="text-accent hover:underline">
          approved by {approvalName} on {approvalDate}.
        </a>
      )}
    </div>
  );
}

export const CompositionErrorsSection_SchemaErrorConnection = graphql(`
  fragment CompositionErrorsSection_SchemaErrorConnection on SchemaErrorConnection {
    edges {
      node {
        message
      }
    }
  }
`);

export function CompositionErrorsSection(props: {
  compositionErrors: FragmentType<typeof CompositionErrorsSection_SchemaErrorConnection>;
}) {
  const compositionErrors = useFragment(
    CompositionErrorsSection_SchemaErrorConnection,
    props.compositionErrors,
  );

  return (
    <CompositionErrorsList
      errors={compositionErrors?.edges?.map(edge => edge.node) ?? []}
      title="Composition Errors"
    />
  );
}

export function CompositionErrorsList(props: {
  errors: ReadonlyArray<{ message: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-2">
      <ChangesTitle data-cy="composition-errors-title">
        {props.title}
        <CompositionErrorsPopover />
      </ChangesTitle>
      {props.description ? (
        <p className="mb-2 text-sm text-fg-default">{props.description}</p>
      ) : null}
      <ul>
        {props.errors.map((error, index) => (
          <li key={index} className="mb-1 ml-[1.25em] list-[square] pl-0 marker:pl-1">
            <CompositionErrorMessage message={error.message} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoGraphChanges() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CircleCheckIcon className="size-4 text-success" />
        <h2 className="text-base font-medium text-fg">No Graph Changes</h2>
      </div>
      <p className="text-xs text-fg-secondary">
        There are no changes in this graph for this graph.
      </p>
    </div>
  );
}
