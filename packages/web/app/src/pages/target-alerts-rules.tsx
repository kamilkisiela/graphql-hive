import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useQuery } from 'urql';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { PageLead } from '@/components/ui/page-lead';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Popover } from '@/components/ui/primitives/floating/popover/popover';
import { graphql } from '@/gql';
import {
  AlertChannelType,
  MetricAlertRuleSeverity,
  MetricAlertRuleState,
  MetricAlertRuleType,
} from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { useKeepPreviousData } from '@/lib/hooks/use-keep-previous-data';
import { useNavigate } from '@tanstack/react-router';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';

export const TargetAlertsRulesPage_Query = graphql(`
  query TargetAlertsRulesPage_Query(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
  ) {
    target(
      reference: {
        bySelector: {
          organizationSlug: $organizationSlug
          projectSlug: $projectSlug
          targetSlug: $targetSlug
        }
      }
    ) {
      id
      metricAlertRulesLimit
      metricAlertRules {
        id
        name
        type
        severity
        state
        enabled
        lastTriggeredAt
        updatedAt
        incidentCount
        channels {
          id
          type
          name
          ... on AlertSlackChannel {
            channel
          }
          ... on AlertWebhookChannel {
            endpoint
          }
          ... on TeamsWebhookChannel {
            endpoint
          }
        }
        createdBy {
          id
          displayName
        }
      }
    }
  }
`);

type RuleRow = {
  id: string;
  name: string;
  type: MetricAlertRuleType;
  severity: MetricAlertRuleSeverity;
  state: MetricAlertRuleState;
  enabled: boolean;
  lastTriggeredAt?: string | null;
  updatedAt: string;
  incidentCount: number;
  channels: ReadonlyArray<{ id: string; type: string; name: string; detail: string | null }>;
  createdBy?: { id: string; displayName: string } | null;
};

const TYPE_LABEL: Record<MetricAlertRuleType, string> = {
  [MetricAlertRuleType.ErrorRate]: 'Reliability',
  [MetricAlertRuleType.Latency]: 'Latency',
  [MetricAlertRuleType.Traffic]: 'Traffic',
};

const SEVERITY_DOT_COLOR: Record<MetricAlertRuleSeverity, 'critical' | 'warning' | 'info'> = {
  [MetricAlertRuleSeverity.Critical]: 'critical',
  [MetricAlertRuleSeverity.Warning]: 'warning',
  [MetricAlertRuleSeverity.Info]: 'info',
};

const SEVERITY_LABEL: Record<MetricAlertRuleSeverity, string> = {
  [MetricAlertRuleSeverity.Critical]: 'Critical',
  [MetricAlertRuleSeverity.Warning]: 'Warning',
  [MetricAlertRuleSeverity.Info]: 'Info',
};

const SEVERITY_RANK: Record<MetricAlertRuleSeverity, number> = {
  [MetricAlertRuleSeverity.Critical]: 3,
  [MetricAlertRuleSeverity.Warning]: 2,
  [MetricAlertRuleSeverity.Info]: 1,
};

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  [AlertChannelType.Slack]: 'Slack',
  [AlertChannelType.Webhook]: 'Webhook',
  [AlertChannelType.MsteamsWebhook]: 'MS Teams',
  [AlertChannelType.Discord]: 'Discord',
};

function destinationLabel(channels: ReadonlyArray<{ type: string }>): string {
  if (channels.length === 0) return '—';
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const c of channels) {
    if (!counts.has(c.type)) order.push(c.type);
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return order
    .map(type => {
      const label = CHANNEL_TYPE_LABEL[type] ?? type;
      const count = counts.get(type) ?? 0;
      return count > 1 ? `${label} (${count})` : label;
    })
    .join(', ');
}

const columnHelper = createColumnHelper<RuleRow>();

const RULE_COLUMNS: ColumnDef<RuleRow, any>[] = [
  columnHelper.accessor('name', {
    header: 'Name',
    meta: { sortable: true, width: 'fill' },
    cell: info => (
      <DataTableCell
        kind="text"
        value={info.getValue()}
        weight="medium"
        trailing={
          info.row.original.enabled ? undefined : (
            <Badge content="Paused" variants={{ variant: 'info' }} />
          )
        }
      />
    ),
  }),
  columnHelper.accessor('type', {
    header: 'Type',
    meta: { sortable: true },
    // The enum names order differently from the labels the cell shows.
    sortingFn: (a, b) => TYPE_LABEL[a.original.type].localeCompare(TYPE_LABEL[b.original.type]),
    cell: info => (
      <DataTableCell
        kind="text"
        value={TYPE_LABEL[info.getValue() as MetricAlertRuleType]}
        tone="muted"
      />
    ),
  }),
  columnHelper.accessor('severity', {
    header: 'Severity',
    meta: { sortable: true },
    sortingFn: (a, b) => SEVERITY_RANK[a.original.severity] - SEVERITY_RANK[b.original.severity],
    cell: info => {
      const sev = info.getValue() as MetricAlertRuleSeverity;
      return (
        <DataTableCell kind="status" label={SEVERITY_LABEL[sev]} dot={SEVERITY_DOT_COLOR[sev]} />
      );
    },
  }),
  columnHelper.accessor('incidentCount', {
    header: 'Incidents',
    meta: { sortable: true, align: 'right' },
    cell: info => <DataTableCell kind="number" value={info.getValue()} />,
  }),
  columnHelper.accessor('lastTriggeredAt', {
    header: 'Last triggered',
    meta: { sortable: true },
    sortingFn: (a, b) => {
      const av = a.original.lastTriggeredAt ? new Date(a.original.lastTriggeredAt).getTime() : 0;
      const bv = b.original.lastTriggeredAt ? new Date(b.original.lastTriggeredAt).getTime() : 0;
      return av - bv;
    },
    cell: info => {
      const date = info.getValue();
      return date ? (
        <DataTableCell kind="time" date={date} tone="muted" />
      ) : (
        <DataTableCell kind="placeholder" />
      );
    },
  }),
  columnHelper.accessor('updatedAt', {
    header: 'Last updated',
    meta: { sortable: true },
    sortingFn: (a, b) =>
      new Date(a.original.updatedAt).getTime() - new Date(b.original.updatedAt).getTime(),
    cell: info => <DataTableCell kind="time" date={info.getValue()} tone="muted" />,
  }),
  columnHelper.display({
    id: 'destination',
    header: 'Destination',
    cell: ctx => {
      const channels = ctx.row.original.channels;
      if (channels.length === 0) {
        return <DataTableCell kind="placeholder" />;
      }
      return (
        <DataTableCell
          kind="text"
          value={destinationLabel(channels)}
          trailing={
            <Popover
              trigger={
                <button
                  type="button"
                  aria-label="Destinations"
                  className="inline-flex text-fg-muted hover:text-fg-default"
                  // The row opens the rule; a click on the icon only means the popover.
                  onClick={event => event.stopPropagation()}
                >
                  <Info className="size-3.5" />
                </button>
              }
              openOnHover
              width="auto"
              content={
                <div className="space-y-1 text-xs">
                  {channels.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="text-fg-secondary">
                        {CHANNEL_TYPE_LABEL[c.type] ?? c.type}
                      </span>
                      <span className="font-mono text-fg">{c.detail ?? c.name}</span>
                    </div>
                  ))}
                </div>
              }
            />
          }
        />
      );
    },
  }),
  columnHelper.display({
    id: 'createdBy',
    header: 'Created by',
    cell: ctx => {
      const u = ctx.row.original.createdBy;
      return u ? (
        <DataTableCell kind="avatar" name={u.displayName} />
      ) : (
        <DataTableCell kind="placeholder" />
      );
    },
  }),
];

function UsageChip({ used, limit }: { used: number; limit: number }) {
  const ratio = limit > 0 ? used / limit : 0;
  const color =
    used >= limit
      ? 'border-critical-line bg-critical-tint-subtle text-critical'
      : ratio >= 0.8
        ? 'border-warning-line bg-warning-tint text-warning-text'
        : 'border-line bg-surface-card text-fg-default';
  const label = `${used} / ${limit} rules`;
  const title =
    used >= limit
      ? 'Limit reached. Delete a rule to free a slot.'
      : `${used} of ${limit} configured rules used.`;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${color}`}
    >
      {label}
    </span>
  );
}

export function TargetAlertsRulesPage() {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const navigate = useNavigate();

  const [result] = useQuery({
    query: TargetAlertsRulesPage_Query,
    variables: { organizationSlug, projectSlug, targetSlug },
  });

  const previousData = useKeepPreviousData(result.data, result.fetching || result.stale);
  const data = result.data ?? previousData;
  const rules: RuleRow[] = useMemo(
    () =>
      (data?.target?.metricAlertRules ?? []).map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        severity: r.severity,
        state: r.state,
        enabled: r.enabled,
        lastTriggeredAt: r.lastTriggeredAt,
        updatedAt: r.updatedAt,
        incidentCount: r.incidentCount,
        channels: r.channels.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          detail:
            c.__typename === 'AlertSlackChannel'
              ? c.channel
              : c.__typename === 'AlertWebhookChannel' || c.__typename === 'TeamsWebhookChannel'
                ? c.endpoint
                : null,
        })),
        createdBy: r.createdBy
          ? { id: r.createdBy.id, displayName: r.createdBy.displayName }
          : null,
      })),
    [data?.target?.metricAlertRules],
  );
  const limit = data?.target?.metricAlertRulesLimit;

  return (
    <>
      <PageLead
        title="Configured alerts"
        description="The following alerts are currently active for this target."
        titleAccessory={
          limit !== undefined ? <UsageChip used={rules.length} limit={limit} /> : null
        }
      />

      {result.error && !data ? (
        <div className="flex justify-center py-12 text-sm text-critical">
          Failed to load alert rules: {result.error.message}
        </div>
      ) : (
        <DataTable
          loading={result.fetching && !data}
          data={rules}
          columns={RULE_COLUMNS}
          getRowId={r => r.id}
          emptyMessage="No alerts configured yet."
          onRowClick={r => {
            void navigate({
              to: '/$organizationSlug/$projectSlug/$targetSlug/alerts/$ruleId',
              params: { organizationSlug, projectSlug, targetSlug, ruleId: r.id },
            });
          }}
        />
      )}
    </>
  );
}
