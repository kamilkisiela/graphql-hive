import { AlertTriangleIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { Menu } from '@/components/ui/primitives/floating/menu/menu';
import { useSlugs } from '@/lib/hooks';
import { formatCount } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';

export type CheckTarget = {
  id: string;
  slug: string;
  target: { id: string; slug: string } | null;
};

export type TargetUsage = {
  target: CheckTarget;
  count: number;
  countFormatted: string;
  operationCount: number | null;
};

function useCoordinateLink(coordinate: string, period: { from: string; to: string }) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  return (targetSlug: string) => (
    <Link
      to="/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate"
      params={{ organizationSlug, projectSlug, targetSlug, coordinate }}
      search={{ from: period.from, to: period.to }}
      target="_blank"
      preload={false}
    />
  );
}

function UnusedTargetsMenu(props: {
  unused: CheckTarget[];
  coordinate: string;
  period: { from: string; to: string };
}) {
  const link = useCoordinateLink(props.coordinate, props.period);
  return (
    <Menu
      align="end"
      trigger={
        <Button variant="ghost" size="compact">
          {props.unused.length} without usage
          <ChevronDownIcon className="size-3" />
        </Button>
      }
      sections={[
        {
          label: 'No requests during the check window',
          items: props.unused.map(target =>
            target.target
              ? {
                  label: target.slug,
                  trailingIcon: ExternalLinkIcon,
                  render: link(target.target.slug),
                }
              : { label: target.slug, disabled: true, tooltip: 'Target does no longer exist.' },
          ),
        },
      ]}
    />
  );
}

export function BreakingChangeTargets(props: {
  affectedTargets: TargetUsage[];
  targets: CheckTarget[];
  coordinate: string;
  period: { from: string; to: string };
}) {
  const link = useCoordinateLink(props.coordinate, props.period);
  const used = new Set(props.affectedTargets.map(affected => affected.target.id));
  const unused = props.targets.filter(target => !used.has(target.id));
  const rows = props.affectedTargets;

  const columns: ColumnDef<TargetUsage, unknown>[] = [
    {
      id: 'target',
      meta: { width: 'md' },
      cell: ({ row }) =>
        row.original.target.target ? (
          <DataTableCell kind="text" value={row.original.target.slug} weight="medium" />
        ) : (
          <DataTableCell
            kind="text"
            tone="muted"
            value={`${row.original.target.slug} (no longer exists)`}
          />
        ),
    },
    {
      id: 'usage',
      meta: { width: 'fill' },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <Badge
            content={formatCount(row.original.count, 'request', row.original.countFormatted)}
            variants={{ variant: 'outline' }}
          />
          {row.original.operationCount ? (
            <span className="text-xs text-fg-secondary">
              from {formatCount(row.original.operationCount, 'operation')}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'verify',
      meta: { align: 'right', width: 'md' },
      cell: ({ row }) =>
        row.original.target.target ? (
          <Button variant="primary" size="compact" render={link(row.original.target.target.slug)}>
            Verify in Insights
            <ExternalLinkIcon className="size-3" />
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={row => row.target.id}
      pagination={{ kind: 'none' }}
      variants={{ tone: 'critical' }}
      title={{
        label: `Used in ${rows.length} of ${formatCount(props.targets.length, 'target')} during the check window`,
        icon: AlertTriangleIcon,
        aside: unused.length ? (
          <UnusedTargetsMenu unused={unused} coordinate={props.coordinate} period={props.period} />
        ) : undefined,
      }}
    />
  );
}
