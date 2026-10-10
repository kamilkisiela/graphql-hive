import { AlertTriangle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';

export type ContractFailure = {
  key: string;
  label: string;
  reason: string;
  detail?: string;
  onView?: () => void;
};

export function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function ContractFailuresTable(props: {
  title: string;
  aside?: string;
  items: ContractFailure[];
}) {
  if (props.items.length === 0) {
    return null;
  }
  const columns: ColumnDef<ContractFailure, unknown>[] = [
    {
      id: 'label',
      meta: { width: 'md' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.label} truncate />,
    },
    {
      id: 'reason',
      meta: { width: 'fill' },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <Badge content={row.original.reason} variants={{ variant: 'critical' }} />
          {row.original.detail ? (
            <span className="text-xs text-fg-secondary">{row.original.detail}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'view',
      meta: { align: 'right' },
      cell: ({ row }) =>
        row.original.onView ? (
          <Button variant="ghost" size="compact" onClick={row.original.onView}>
            View
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      data={props.items}
      columns={columns}
      getRowId={row => row.key}
      pagination={{ kind: 'none' }}
      variants={{ tone: 'critical' }}
      title={{ label: props.title, icon: AlertTriangle, aside: props.aside }}
    />
  );
}
