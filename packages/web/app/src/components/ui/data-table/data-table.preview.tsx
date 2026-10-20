import { useState } from 'react';
import { Check, CircleAlert, Trash2 } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { Button } from '../primitives/button/button';
import { DataTable } from './data-table';
import { DataTableCell } from './data-table-cell';

export const nav: NavPath = 'Components/DataTable';

type Check = {
  id: string;
  service: string;
  author: string;
  status: 'passed' | 'failed' | 'pending';
  changes: number;
  ranAt: string;
};

const SERVICES = ['checkout', 'accounts', 'catalog', 'shipping', 'reviews', 'search'];
const AUTHORS = ['Ada Lovelace', 'Grace Hopper', 'Edsger Dijkstra', 'Barbara Liskov'];

const CHECKS: Check[] = Array.from({ length: 47 }, (_, i) => ({
  id: `chk_${(1000 + i).toString(16)}`,
  service: SERVICES[i % SERVICES.length],
  author: AUTHORS[i % AUTHORS.length],
  status: i % 7 === 0 ? 'failed' : i % 11 === 0 ? 'pending' : 'passed',
  changes: (i * 3) % 14,
  ranAt: new Date(Date.UTC(2026, 8, 14, 12, 0, 0) - i * 3_600_000 * 7).toISOString(),
}));

const STATUS_VARIANT = {
  passed: 'success',
  failed: 'critical',
  pending: 'outline',
} as const;

const COLUMNS: ColumnDef<Check, any>[] = [
  {
    accessorKey: 'id',
    header: 'Check',
    cell: ({ row }) => <DataTableCell kind="text" value={row.original.id} mono />,
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => <DataTableCell kind="text" value={row.original.service} weight="medium" />,
  },
  {
    accessorKey: 'author',
    header: 'Author',
    cell: ({ row }) => <DataTableCell kind="avatar" name={row.original.author} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <DataTableCell
        kind="badge"
        items={{ content: row.original.status, variant: STATUS_VARIANT[row.original.status] }}
      />
    ),
  },
  {
    accessorKey: 'changes',
    header: 'Changes',
    meta: { align: 'right', width: 'xs', sortable: true },
    cell: ({ row }) => <DataTableCell kind="number" value={row.original.changes} />,
  },
  {
    accessorKey: 'ranAt',
    header: 'Ran',
    meta: { sortable: true, tooltip: 'When the check finished.' },
    cell: ({ row }) => <DataTableCell kind="time" date={row.original.ranAt} mode="relative-info" />,
  },
];

/** Striped by default, every cell a DataTableCell. */
export const Default = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable data={CHECKS.slice(0, 6)} columns={COLUMNS} getRowId={row => row.id} />
  </div>
));

/**
 * `onSurface="raised"` steps the wrapper, header and stripes up one, for a table inside a sheet,
 * dialog or raised card. The block behind it here is that surface.
 */
export const OnSurface = createPreview(() => (
  <div className="w-[56rem] rounded-md border border-line bg-surface-overlay p-6">
    <DataTable
      data={CHECKS.slice(0, 4)}
      columns={COLUMNS}
      getRowId={row => row.id}
      variants={{ onSurface: 'raised' }}
    />
  </div>
));

export const Unstriped = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 6)}
      columns={COLUMNS}
      getRowId={row => row.id}
      variants={{ striped: false }}
    />
  </div>
));

/** Without the border and fill, for a table that sits inside a panel that already has both. */
export const Borderless = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 4)}
      columns={COLUMNS}
      getRowId={row => row.id}
      variants={{ bordered: false }}
    />
  </div>
));

/**
 * Columns opt into sorting with `meta.sortable`; the header becomes a toggle with an arrow that
 * fades when inactive and turns green when it is the sort. Sorting is the table's own unless
 * `sorting` hands it to the page.
 */
export const Sortable = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable data={CHECKS.slice(0, 8)} columns={COLUMNS} getRowId={row => row.id} />
  </div>
));

const MULTI_SORT_COLUMNS: ColumnDef<Check, any>[] = COLUMNS.map(column =>
  'accessorKey' in column && column.accessorKey === 'status'
    ? { ...column, meta: { sortable: true } }
    : column,
);

/**
 * Shift-click a second header to add it as a tiebreaker: rows that tie on the first sort are
 * ordered by the second. Once a sort exists, hovering any other sortable header says so, and
 * stacked headers number their priority. `initialSorting` opens the table already sorted, for
 * rows that arrive in a known order.
 */
export const MultiSort = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 12)}
      columns={MULTI_SORT_COLUMNS}
      getRowId={row => row.id}
      initialSorting={[{ id: 'status', desc: false }]}
    />
  </div>
));

/** A page that sorts on the server owns the sorting state and asks the table not to sort. */
export const ServerSorted = createPreview(() => <ServerSortedTable />);

function ServerSortedTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'changes', desc: true }]);
  const sorted = CHECKS.slice(0, 8).sort((a, b) =>
    sorting[0]?.desc ? b.changes - a.changes : a.changes - b.changes,
  );
  return (
    <div className="w-[52rem]">
      <p className="mb-3 text-xs text-fg-secondary">
        Sorted by {sorting[0]?.id ?? 'nothing'} {sorting[0]?.desc ? 'descending' : 'ascending'},
        outside the table.
      </p>
      <DataTable
        data={sorted}
        columns={COLUMNS}
        getRowId={row => row.id}
        sorting={{ state: sorting, onChange: setSorting, manual: true }}
      />
    </div>
  );
}

/** The server takes a moment: the sorted column's arrow spins and the old order dims. */
export const SortLoading = createPreview(() => <SortLoadingTable />);

function SortLoadingTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'changes', desc: true }]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(() => sortChecks(sorting));

  return (
    <div className="w-[52rem]">
      <DataTable
        data={rows}
        columns={COLUMNS}
        getRowId={row => row.id}
        sorting={{
          state: sorting,
          manual: true,
          loading,
          onChange: updater => {
            const next = typeof updater === 'function' ? updater(sorting) : updater;
            setSorting(next);
            setLoading(true);
            setTimeout(() => {
              setRows(sortChecks(next));
              setLoading(false);
            }, 1500);
          },
        }}
      />
    </div>
  );
}

function sortChecks(sorting: SortingState) {
  const [sort] = sorting;
  return CHECKS.slice(0, 8).sort((a, b) => {
    const [x, y] = sort?.id === 'ranAt' ? [a.ranAt, b.ranAt] : [a.changes, b.changes];
    const order = x < y ? -1 : x > y ? 1 : 0;
    return sort?.desc ? -order : order;
  });
}

/** A search or filter is in flight: the last settled rows stay, dimmed and inert. */
export const Refreshing = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable data={CHECKS.slice(0, 5)} columns={COLUMNS} getRowId={row => row.id} refreshing />
  </div>
));

/** No column declares a header, so there is no header row: a list of one thing. */
export const Headerless = createPreview(() => <HeaderlessList />);

function HeaderlessList() {
  const [checked, setChecked] = useState<string[]>(['chk_3e9']);
  const columns: ColumnDef<Check, any>[] = [
    {
      id: 'select',
      meta: { width: 'xs' },
      cell: ({ row }) => (
        <DataTableCell
          kind="checkbox"
          checked={checked.includes(row.original.id)}
          onCheckedChange={on =>
            setChecked(prev =>
              on ? [...prev, row.original.id] : prev.filter(id => id !== row.original.id),
            )
          }
          label={`Select ${row.original.id}`}
        />
      ),
    },
    {
      accessorKey: 'id',
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.id} mono />,
    },
    {
      accessorKey: 'service',
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.service} />,
    },
    {
      accessorKey: 'ranAt',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <DataTableCell kind="time" date={row.original.ranAt} prefix="ran" tone="muted" />
      ),
    },
  ];
  return (
    <div className="w-[44rem]">
      <DataTable data={CHECKS.slice(0, 5)} columns={columns} getRowId={row => row.id} />
    </div>
  );
}

/** `meta` on a column sets its alignment, width and the breakpoint below which it hides. */
export const ColumnLayout = createPreview(() => {
  const columns: ColumnDef<Check, any>[] = [
    {
      accessorKey: 'id',
      header: 'Check (xs)',
      meta: { width: 'xs' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.id} mono />,
    },
    {
      accessorKey: 'service',
      header: 'Service (fill)',
      meta: { width: 'fill' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.service} />,
    },
    {
      accessorKey: 'author',
      header: 'Author (hides below sm)',
      meta: { hideBelow: 'sm' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.author} />,
    },
    {
      accessorKey: 'changes',
      header: 'Changes (right)',
      meta: { align: 'right', width: 'sm' },
      cell: ({ row }) => <DataTableCell kind="number" value={row.original.changes} />,
    },
  ];
  return (
    <div className="w-[52rem]">
      <DataTable data={CHECKS.slice(0, 4)} columns={columns} getRowId={row => row.id} />
    </div>
  );
});

/** Client pagination: numbered pages once the rows exceed the page size. */
export const Paginated = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS}
      columns={COLUMNS}
      pagination={{ kind: 'client', pageSize: 8 }}
      getRowId={row => row.id}
    />
  </div>
));

/**
 * Cursor pagination, for a connection the API pages with `first` and `after`: the page owns the
 * cursors and the table shows previous, next and a summary. No page numbers, since the API has no
 * offsets to give.
 */
export const CursorPaginated = createPreview(() => <CursorPaginatedTable />);

function CursorPaginatedTable() {
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 6;
  const rows = CHECKS.slice(page * pageSize, page * pageSize + pageSize);
  const go = (next: number) => {
    setLoading(true);
    setTimeout(() => {
      setPage(next);
      setLoading(false);
    }, 400);
  };
  return (
    <div className="w-[52rem]">
      <DataTable
        data={rows}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{
          kind: 'cursor',
          hasPreviousPage: page > 0,
          hasNextPage: (page + 1) * pageSize < CHECKS.length,
          onPrevious: () => go(page - 1),
          onNext: () => go(page + 1),
          summary: `Showing ${page * pageSize + 1} to ${page * pageSize + rows.length} of ${CHECKS.length} checks`,
          loading,
        }}
      />
    </div>
  );
}

export const TitleBar = createPreview(() => (
  <div className="flex w-[52rem] flex-col gap-6">
    <DataTable
      data={CHECKS.slice(0, 3)}
      columns={COLUMNS}
      getRowId={row => row.id}
      pagination={{ kind: 'none' }}
      title={{ label: 'Recent checks', icon: Check, aside: '3 of 47' }}
    />
    <DataTable
      data={CHECKS.slice(0, 3)}
      columns={COLUMNS}
      getRowId={row => row.id}
      pagination={{ kind: 'none' }}
      title={{
        label: 'Recent checks',
        icon: Check,
        aside: (
          <Button variant="ghost" size="compact">
            44 more
          </Button>
        ),
      }}
    />
  </div>
));

export const Toned = createPreview(() => (
  <div className="flex w-[52rem] flex-col gap-6">
    {(['critical', 'warning'] as const).map(tone => (
      <DataTable
        key={tone}
        data={CHECKS.slice(0, 4)}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{ kind: 'none' }}
        variants={{ tone }}
        title={{
          label: `Used in 4 of 11 targets (${tone})`,
          icon: CircleAlert,
          aside: (
            <Button variant="ghost" size="compact">
              7 without usage
            </Button>
          ),
        }}
      />
    ))}
    <DataTable
      data={CHECKS.slice(0, 4)}
      columns={COLUMNS}
      getRowId={row => row.id}
      pagination={{ kind: 'none' }}
      variants={{ tone: 'critical' }}
    />
  </div>
));

/** A closing row for a total. */
export const Footer = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 4)}
      columns={COLUMNS}
      getRowId={row => row.id}
      pagination={{ kind: 'none' }}
      footer={{
        label: 'Total changes',
        value: CHECKS.slice(0, 4).reduce((sum, check) => sum + check.changes, 0),
      }}
    />
  </div>
));

export const Loading = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable data={[]} columns={COLUMNS} getRowId={row => row.id} loading />
  </div>
));

export const Empty = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={[]}
      columns={COLUMNS}
      getRowId={row => row.id}
      emptyMessage="No schema checks have run for this target yet."
    />
  </div>
));

/**
 * Row state the data implies: `rowState` mutes or disables a row, `selectedRowId` marks the one
 * the page is showing details for. Click a row to select it.
 */
export const RowStates = createPreview(() => <RowStatesTable />);

function RowStatesTable() {
  const [selected, setSelected] = useState<string | undefined>(CHECKS[1].id);
  return (
    <div className="w-[52rem]">
      <DataTable
        data={CHECKS.slice(0, 6)}
        columns={COLUMNS}
        getRowId={row => row.id}
        selectedRowId={selected}
        onRowClick={row => setSelected(row.id)}
        hideRowIndicator
        rowState={row =>
          row.status === 'failed'
            ? { disabled: true }
            : row.status === 'pending'
              ? { muted: true }
              : undefined
        }
      />
    </div>
  );
}

/** `renderSubComponent` makes rows expandable and adds the trailing chevron. */
export const Expandable = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 6)}
      columns={COLUMNS}
      getRowId={row => row.id}
      renderSubComponent={row => (
        <div className="space-y-1 p-4 text-control text-fg-default">
          <div>
            Composition for <span className="text-fg">{row.original.service}</span> produced{' '}
            {row.original.changes} schema changes.
          </div>
          <div className="text-fg-muted">Check id: {row.original.id}</div>
        </div>
      )}
    />
  </div>
));

export const Clickable = createPreview(() => (
  <div className="w-[52rem]">
    <DataTable
      data={CHECKS.slice(0, 6)}
      columns={COLUMNS}
      getRowId={row => row.id}
      onRowClick={() => {}}
    />
  </div>
));

// ---------------------------------------------------------------------------
// Every DataTableCell kind, one row each, inside a real table.
// ---------------------------------------------------------------------------

type CellRow = { id: string; kind: string; sample: React.ReactNode; note: string };

const CELL_ROWS: CellRow[] = [
  {
    id: 'text',
    kind: 'text',
    sample: <DataTableCell kind="text" value="checkout-web" />,
    note: 'Regular weight, the row colour.',
  },
  {
    id: 'text-medium',
    kind: 'text, weight=medium',
    sample: <DataTableCell kind="text" value="CI publish" weight="medium" />,
    note: 'The name column of a record.',
  },
  {
    id: 'text-muted',
    kind: 'text, tone=muted, secondary',
    sample: (
      <DataTableCell kind="text" value="Base price" secondary="(unlimited seats)" tone="default" />
    ),
    note: 'A muted aside after the value, or a muted value.',
  },
  {
    id: 'text-mono',
    kind: 'text, mono',
    sample: <DataTableCell kind="text" value="hv2••••••••••••••••••••" mono />,
    note: 'Keys, hashes, domains.',
  },
  {
    id: 'text-trailing',
    kind: 'text, trailing',
    sample: (
      <DataTableCell
        kind="text"
        value="Admin"
        weight="medium"
        trailing={<DataTableCell kind="badge" items={{ content: 'default', variant: 'outline' }} />}
      />
    ),
    note: 'Something after the value that qualifies it.',
  },
  {
    id: 'number',
    kind: 'number',
    sample: <DataTableCell kind="number" value={12_408} />,
    note: 'Right-aligned, tabular figures, formatted from a number.',
  },
  {
    id: 'number-percent',
    kind: 'number, format=percent / currency',
    sample: (
      <span className="flex flex-col">
        <DataTableCell kind="number" value={38.2} format="percent" />
        <DataTableCell kind="number" value={130} format="currency" />
      </span>
    ),
    note: '',
  },
  {
    id: 'number-compact',
    kind: 'number, format=compact',
    sample: <DataTableCell kind="number" value={1_234_567} format="compact" />,
    note: 'For a column scanned for magnitude.',
  },
  {
    id: 'time',
    kind: 'time, mode=relative',
    sample: <DataTableCell kind="time" date={CHECKS[3].ranAt} />,
    note: 'The absolute time is the title.',
  },
  {
    id: 'time-abs',
    kind: 'time, mode=absolute',
    sample: <DataTableCell kind="time" date={CHECKS[3].ranAt} mode="absolute" />,
    note: '',
  },
  {
    id: 'time-date',
    kind: 'time, mode=date',
    sample: <DataTableCell kind="time" date={CHECKS[3].ranAt} mode="date" />,
    note: 'The day alone.',
  },
  {
    id: 'time-info',
    kind: 'time, mode=relative-info, prefix',
    sample: (
      <DataTableCell kind="time" date={CHECKS[3].ranAt} mode="relative-info" prefix="created" />
    ),
    note: 'Relative, with the absolute time on the info icon.',
  },
  {
    id: 'link',
    kind: 'link',
    sample: <DataTableCell kind="link" label="checkout-web" href="#" />,
    note: 'The value is the link.',
  },
  {
    id: 'link-accent',
    kind: 'link, tone=accent, mono',
    sample: <DataTableCell kind="link" label="a91f_GetCart" href="#" tone="accent" mono />,
    note: '',
  },
  {
    id: 'truncate',
    kind: 'text / link, truncate',
    sample: (
      <span className="flex w-40 flex-col">
        <DataTableCell kind="text" value="hive-schema-registry-worker" truncate />
        <DataTableCell kind="link" label="hive-schema-registry-worker" href="#" truncate />
      </span>
    ),
    note: 'Cut at the column width; the full value is the title.',
  },
  {
    id: 'link-out',
    kind: 'link-out, one target',
    sample: (
      <DataTableCell
        kind="link-out"
        label="a91f_GetCart"
        targets={[{ label: 'production', href: '#' }]}
        tooltip="Open in Insights"
        mono
      />
    ),
    note: 'The value stays text; the icon after it goes to the target.',
  },
  {
    id: 'link-out-many',
    kind: 'link-out, several targets',
    sample: (
      <DataTableCell
        kind="link-out"
        label="a91f_GetCart"
        targets={[
          { label: 'production', href: '#' },
          { label: 'staging', href: '#' },
          { label: 'development', href: '#' },
        ]}
        tooltip="Open in Insights"
        mono
      />
    ),
    note: 'A menu on a chevron trigger, one row per target.',
  },
  {
    id: 'badge',
    kind: 'badge',
    sample: (
      <DataTableCell
        kind="badge"
        items={[
          { content: 'public' },
          { content: 'internal' },
          { content: 'active', variant: 'success' },
        ]}
      />
    ),
    note: 'One or a wrapped list.',
  },
  {
    id: 'badge-max',
    kind: 'badge, max=2',
    sample: (
      <DataTableCell
        kind="badge"
        max={2}
        items={[
          { content: 'platform' },
          { content: 'billing' },
          { content: 'support' },
          { content: 'security' },
        ]}
      />
    ),
    note: 'The rest collapse into a +N badge that lists them.',
  },
  {
    id: 'boolean',
    kind: 'boolean',
    sample: (
      <span className="flex gap-3">
        <DataTableCell kind="boolean" value />
        <DataTableCell kind="boolean" value={false} />
      </span>
    ),
    note: '',
  },
  {
    id: 'status-dot',
    kind: 'status, dot',
    sample: <DataTableCell kind="status" label="Critical" dot="critical" />,
    note: '',
  },
  {
    id: 'status-icon',
    kind: 'status, icon',
    sample: (
      <span className="flex flex-col gap-1">
        <DataTableCell kind="status" label="Verified" icon={Check} iconTone="success" />
        <DataTableCell
          kind="status"
          label="Pending"
          icon={CircleAlert}
          iconTone="warning"
          tooltip="The domain ownership challenge has not been completed."
        />
      </span>
    ),
    note: 'A word with an icon; the pending one explains itself on hover.',
  },
  {
    id: 'status-transition',
    kind: 'status, transition',
    sample: (
      <DataTableCell
        kind="status"
        from={{ content: 'OK', variant: 'success' }}
        to={{ content: 'Firing', variant: 'critical' }}
      />
    ),
    note: '',
  },
  {
    id: 'avatar',
    kind: 'avatar',
    sample: <DataTableCell kind="avatar" name="Ada Lovelace" />,
    note: 'Initials from the name, size xs.',
  },
  {
    id: 'avatar-strikethrough',
    kind: 'avatar, strikethrough',
    sample: <DataTableCell kind="avatar" name="Grace Hopper" strikethrough />,
    note: 'A disabled member.',
  },
  {
    id: 'copy',
    kind: 'copy',
    sample: <DataTableCell kind="copy" value="https://app.graphql-hive.com/auth/callback/oidc" />,
    note: 'A copy chip.',
  },
  {
    id: 'checkbox',
    kind: 'checkbox',
    sample: <DataTableCell kind="checkbox" checked onCheckedChange={() => {}} label="Select row" />,
    note: 'Row selection.',
  },
  {
    id: 'actions',
    kind: 'actions',
    sample: (
      <DataTableCell
        kind="actions"
        sections={[
          [
            { label: 'View details', onClick: () => {} },
            { label: 'Delete', variant: 'destructiveAction', onClick: () => {} },
          ],
        ]}
      />
    ),
    note: 'A ghost icon-only button opening a Menu; right-aligned.',
  },
  {
    id: 'icon-button',
    kind: 'icon-button',
    sample: (
      <DataTableCell
        kind="icon-button"
        icon={Trash2}
        label="Delete token"
        onClick={() => {}}
        destructive
      />
    ),
    note: 'One action, no menu.',
  },
  {
    id: 'bar',
    kind: 'bar',
    sample: <DataTableCell kind="bar" value={38} max={100} />,
    note: 'Ten segments, as the Scale it replaces.',
  },
  {
    id: 'placeholder',
    kind: 'placeholder',
    sample: <DataTableCell kind="placeholder" />,
    note: 'Nothing to show, one way.',
  },
];

const CELL_COLUMNS: ColumnDef<CellRow, any>[] = [
  {
    accessorKey: 'sample',
    header: 'Sample',
    meta: { width: 'lg' },
    cell: ({ row }) => row.original.sample,
  },
  {
    accessorKey: 'kind',
    header: 'Kind',
    meta: { width: 'md' },
    cell: ({ row }) => <DataTableCell kind="text" value={row.original.kind} mono />,
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => <DataTableCell kind="text" value={row.original.note} tone="muted" />,
  },
];

/** Every cell kind, in a table, so the row height and alignment are the real ones. */
export const Cells = createPreview(() => (
  <div className="w-[60rem]">
    <DataTable
      data={CELL_ROWS}
      columns={CELL_COLUMNS}
      getRowId={row => row.id}
      pagination={{ kind: 'none' }}
    />
  </div>
));

export const Playground = createPreview({
  controls: {
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    striped: { type: 'boolean', default: true },
    bordered: { type: 'boolean', default: true },
    rows: { type: 'range', default: 12, min: 0, max: CHECKS.length },
    pagination: { type: 'radio', options: ['client', 'none'], default: 'client' },
    pageSize: { type: 'number', default: 8, min: 1 },
    loading: { type: 'boolean', default: false },
    footer: { type: 'boolean', default: false },
  },
  render: v => {
    const data = CHECKS.slice(0, v.rows);
    return (
      <div
        className={
          v.onSurface === 'raised'
            ? 'w-[56rem] rounded-md border border-line bg-surface-overlay p-6'
            : 'w-[52rem]'
        }
      >
        <DataTable
          data={data}
          columns={COLUMNS}
          getRowId={row => row.id}
          loading={v.loading}
          variants={{
            onSurface: v.onSurface as 'base' | 'raised',
            striped: v.striped,
            bordered: v.bordered,
          }}
          pagination={
            v.pagination === 'client' ? { kind: 'client', pageSize: v.pageSize } : { kind: 'none' }
          }
          footer={
            v.footer
              ? {
                  label: 'Total changes',
                  value: data.reduce((sum, check) => sum + check.changes, 0),
                }
              : undefined
          }
          emptyMessage="No schema checks have run for this target yet."
        />
      </div>
    );
  },
});
