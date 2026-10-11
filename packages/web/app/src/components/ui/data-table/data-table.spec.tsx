// @vitest-environment jsdom
import type { ColumnDef } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from './data-table';
import { DataTableCell, formatAbsolute, formatRelative } from './data-table-cell';

type Row = { id: string; name: string; count: number; status: 'open' | 'solved' };

const ROWS: Row[] = [
  { id: 'a', name: 'alpha', count: 3, status: 'open' },
  { id: 'b', name: 'beta', count: 1, status: 'solved' },
  { id: 'c', name: 'gamma', count: 2, status: 'open' },
];

const COLUMNS: ColumnDef<Row, any>[] = [
  { accessorKey: 'name', header: 'Name', cell: ({ row }) => row.original.name },
  {
    accessorKey: 'count',
    header: 'Count',
    meta: { sortable: true, align: 'right' },
    cell: ({ row }) => row.original.count,
  },
];

const STATUS_COLUMN: ColumnDef<Row, any> = {
  accessorKey: 'status',
  header: 'Status',
  meta: { sortable: true },
  cell: ({ row }) => row.original.status,
};

describe('DataTable', () => {
  it('renders a header row only when a column declares a header', () => {
    const { container, rerender } = render(
      <DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} />,
    );
    expect(container.querySelector('thead')).not.toBeNull();

    const headerless: ColumnDef<Row, any>[] = [
      { accessorKey: 'name', cell: ({ row }) => row.original.name },
    ];
    rerender(<DataTable data={ROWS} columns={headerless} getRowId={row => row.id} />);
    expect(container.querySelector('thead')).toBeNull();
  });

  it('sorts by a sortable column when its header is clicked', () => {
    const { container } = render(
      <DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} />,
    );
    const names = () =>
      [...container.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
    expect(names()).toEqual(['alpha', 'beta', 'gamma']);
    const arrow = () => screen.getByText('Count').querySelector('svg')?.getAttribute('class');
    expect(arrow()).not.toContain('text-success');
    // A numeric column sorts descending first, so the biggest count leads.
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['alpha', 'gamma', 'beta']);
    expect(arrow()).toContain('text-success');
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('opens with the initial sort so the first click flips it', () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        initialSorting={[{ id: 'count', desc: true }]}
      />,
    );
    const names = () =>
      [...container.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
    const arrow = () => screen.getByText('Count').querySelector('svg')?.getAttribute('class');
    expect(names()).toEqual(['alpha', 'gamma', 'beta']);
    expect(arrow()).toContain('text-success');
    fireEvent.click(screen.getByText('Count'));
    expect(names()).toEqual(['beta', 'gamma', 'alpha']);
  });

  it('stacks a tiebreaker on shift-click and replaces the sort on a plain click', () => {
    const rows: Row[] = [
      { id: 'a', name: 'alpha', count: 1, status: 'open' },
      { id: 'b', name: 'beta', count: 3, status: 'solved' },
      { id: 'c', name: 'gamma', count: 2, status: 'open' },
    ];
    const { container } = render(
      <DataTable data={rows} columns={[...COLUMNS, STATUS_COLUMN]} getRowId={row => row.id} />,
    );
    const names = () =>
      [...container.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
    fireEvent.click(screen.getByText('Status'));
    expect(names()).toEqual(['alpha', 'gamma', 'beta']);
    // Both open rows tie on status, so count decides between them.
    fireEvent.click(screen.getByText('Count'), { shiftKey: true });
    expect(names()).toEqual(['gamma', 'alpha', 'beta']);
    fireEvent.click(screen.getByText('Status'));
    expect(names()).toEqual(['beta', 'alpha', 'gamma']);
  });

  it('offers shift only once a column is sorted and numbers stacked sorts', () => {
    render(
      <DataTable data={ROWS} columns={[...COLUMNS, STATUS_COLUMN]} getRowId={row => row.id} />,
    );
    const hint = () => screen.queryByText('Shift-click to add as a secondary sort');
    const priority = (name: string) =>
      screen.getByText(name).querySelector('[aria-label="Sort priority"]')?.textContent ?? null;

    fireEvent.focus(screen.getByText('Count'));
    expect(hint()).toBeNull();

    fireEvent.click(screen.getByText('Status'));
    fireEvent.focus(screen.getByText('Count'));
    expect(hint()).not.toBeNull();
    expect(priority('Status')).toBeNull();

    fireEvent.click(screen.getByText('Count'), { shiftKey: true });
    expect(priority('Status')).toBe('1');
    expect(priority('Count')).toBe('2');
    fireEvent.focus(screen.getByText('Count'));
    expect(hint()).toBeNull();
  });

  it('treats shift-click as a plain click on a server-sorted table', () => {
    const onChange = vi.fn();
    render(
      <DataTable
        data={ROWS}
        columns={[...COLUMNS, STATUS_COLUMN]}
        getRowId={row => row.id}
        sorting={{ state: [{ id: 'count', desc: true }], onChange, manual: true }}
      />,
    );
    fireEvent.click(screen.getByText('Status'), { shiftKey: true });
    expect(onChange.mock.calls[0][0]([{ id: 'count', desc: true }])).toEqual([
      { id: 'status', desc: false },
    ]);
  });

  it('spins the sorted header and dims the old rows while a server sort loads', () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        sorting={{
          state: [{ id: 'count', desc: true }],
          onChange: vi.fn(),
          manual: true,
          loading: true,
        }}
      />,
    );
    expect(screen.getByRole('status', { name: 'Sorting' }).closest('th')).not.toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('alpha').closest('tbody')!.className).toContain('opacity-50');
  });

  it('dims the rows it keeps while refreshing, without touching the header', () => {
    render(<DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} refreshing />);
    expect(screen.getByText('alpha').closest('tbody')!.className).toContain('pointer-events-none');
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('status')).toBeNull();

    render(<DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} />);
    expect(screen.getAllByRole('table')[1].getAttribute('aria-busy')).toBeNull();
  });

  it('toggles a server-sorted column between descending and ascending', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        sorting={{ state: [{ id: 'count', desc: false }], onChange, manual: true }}
      />,
    );
    fireEvent.click(screen.getByText('Count'));
    const next = onChange.mock.calls[0][0]([{ id: 'count', desc: false }]);
    // Ascending would cycle to unsorted on a client table; the server always sorts.
    expect(next).toEqual([{ id: 'count', desc: true }]);

    rerender(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        sorting={{ state: [{ id: 'count', desc: true }], onChange, manual: true }}
      />,
    );
    fireEvent.click(screen.getByText('Count'));
    expect(onChange.mock.calls[1][0]([{ id: 'count', desc: true }])).toEqual([
      { id: 'count', desc: false },
    ]);
  });

  it('toggles a server-sorted column that has no accessor', () => {
    const onChange = vi.fn();
    const idOnly: ColumnDef<Row, unknown>[] = [
      {
        id: 'CREATED_AT',
        header: 'Created',
        meta: { sortable: true },
        cell: ({ row }) => row.original.name,
      },
    ];
    render(
      <DataTable
        data={ROWS}
        columns={idOnly}
        getRowId={row => row.id}
        sorting={{ state: [], onChange, manual: true }}
      />,
    );
    fireEvent.click(screen.getByText('Created'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]([])).toEqual([{ id: 'CREATED_AT', desc: true }]);
  });

  it('brings its own fill only when bordered', () => {
    const { container, rerender } = render(
      <DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} />,
    );
    const wrapper = () => container.firstElementChild as HTMLElement;
    expect(wrapper().className).toContain('border');
    expect(wrapper().className).toContain('bg-neutral-1');

    rerender(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        variants={{ bordered: false }}
      />,
    );
    expect(wrapper().className).not.toContain('border');
    expect(wrapper().className).not.toContain('bg-');
  });

  it('lets the fill column absorb the width and truncate instead of widening the table', () => {
    const columns: ColumnDef<Row, unknown>[] = [
      {
        id: 'name',
        header: 'Name',
        meta: { width: 'fill' },
        cell: ({ row }) => (
          <DataTableCell kind="link" label={row.original.name} href="#" truncate />
        ),
      },
    ];
    const { container } = render(
      <DataTable data={ROWS} columns={columns} getRowId={row => row.id} />,
    );
    const cell = container.querySelector('tbody td') as HTMLElement;
    expect(cell.className).toContain('max-w-0');
    const link = cell.querySelector('a') as HTMLElement;
    expect(link.className).toContain('truncate');
    expect(link.title).toBe('alpha');
  });

  it('marks muted, disabled and selected rows from the data', () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        selectedRowId="c"
        rowState={row =>
          row.status === 'solved'
            ? { muted: true }
            : row.id === 'a'
              ? { disabled: true }
              : undefined
        }
      />,
    );
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows[0].className).toContain('opacity-40');
    expect(rows[1].className).toContain('text-fg-secondary');
    expect(rows[2].getAttribute('data-state')).toBe('selected');
  });

  it('pages client data with first, last, next, previous and a jump field', () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{ kind: 'client', pageSize: 1 }}
      />,
    );
    const names = () =>
      [...document.querySelectorAll('tbody td:first-child')].map(td => td.textContent);
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(names()).toEqual(['alpha']);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByText('Last'));
    expect(names()).toEqual(['gamma']);
    fireEvent.click(screen.getByText('First'));
    expect(names()).toEqual(['alpha']);

    const jump = screen.getByLabelText('Go to page') as HTMLInputElement;
    fireEvent.change(jump, { target: { value: '9' } });
    fireEvent.keyDown(jump, { key: 'Enter' });
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('hands cursor paging to the caller and disables the edge buttons', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{
          kind: 'cursor',
          hasPreviousPage: false,
          hasNextPage: true,
          onPrevious,
          onNext,
          summary: 'Showing 1 to 3 of 12',
        }}
      />,
    );
    expect(screen.getByText('Showing 1 to 3 of 12')).toBeTruthy();
    const previous = screen.getByLabelText('Previous page') as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('spins in the cursor bar and holds both buttons while a page loads', () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{
          kind: 'cursor',
          hasPreviousPage: true,
          hasNextPage: true,
          onPrevious: () => {},
          onNext: () => {},
          summary: 'Page 2',
          loading: true,
        }}
      />,
    );
    expect(screen.getByRole('navigation').querySelector('[role="status"]')).not.toBeNull();
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true);
  });

  it('tints rows on hover only when they do something', () => {
    const { container, rerender } = render(
      <DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} />,
    );
    const row = () => container.querySelector('tbody tr')!;
    expect(row().className).not.toContain('hover:bg-');

    rerender(
      <DataTable data={ROWS} columns={COLUMNS} getRowId={row => row.id} onRowClick={() => {}} />,
    );
    expect(row().className).toContain('hover:bg-');
    expect(row().className).toContain('cursor-pointer');
  });

  it('shows no paging bar when a cursor connection has a single page', () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        pagination={{
          kind: 'cursor',
          hasPreviousPage: false,
          hasNextPage: false,
          onPrevious: () => {},
          onNext: () => {},
          summary: 'Page 1',
        }}
      />,
    );
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('renders a title bar above the column headers, with its far end', () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        title={{ label: 'Used in 2 targets', aside: <button type="button">9 more</button> }}
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const bar = wrapper.firstElementChild as HTMLElement;
    expect(bar.textContent).toContain('Used in 2 targets');
    expect(screen.getByRole('button', { name: '9 more' })).toBeTruthy();
    expect(bar.compareDocumentPosition(container.querySelector('table')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('tints the chrome by tone, and only when bordered', () => {
    const { container, rerender } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        variants={{ tone: 'critical' }}
      />,
    );
    const wrapper = () => container.firstElementChild as HTMLElement;
    expect(wrapper().className).toContain('border-critical-line');
    expect(container.querySelector('th')?.className).toContain('bg-critical-tint');
    expect(container.querySelector('tbody tr')?.className).toContain('border-critical-line-subtle');

    rerender(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        variants={{ tone: 'critical', bordered: false }}
      />,
    );
    expect(wrapper().className).not.toContain('critical');
    expect(container.querySelector('th')?.className).not.toContain('critical');

    rerender(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        variants={{ tone: 'critical' }}
        footer={{ label: 'Total', value: 6 }}
      />,
    );
    expect(container.querySelector('tfoot tr')?.className).toContain('border-critical-line');
  });

  it('renders the footer, the loading row and the empty message', () => {
    const { container, rerender } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        footer={{ label: 'Total', value: 6 }}
      />,
    );
    expect(container.querySelector('tfoot')?.textContent).toContain('Total');
    expect(container.querySelector('tfoot')?.textContent).toContain('6');

    rerender(<DataTable data={[]} columns={COLUMNS} getRowId={row => row.id} loading />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    // Skeleton rows, one line per column, under the real header.
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows).toHaveLength(5);
    expect(skeletonRows[0].querySelectorAll('td [aria-hidden="true"]')).toHaveLength(
      COLUMNS.length,
    );
    expect(container.querySelector('thead')).not.toBeNull();

    rerender(
      <DataTable
        data={[]}
        columns={COLUMNS}
        getRowId={row => row.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});

describe('DataTableCell', () => {
  it('formats numbers by kind', () => {
    const { container } = render(
      <>
        <DataTableCell kind="number" value={12_408} />
        <DataTableCell kind="number" value={38.2} format="percent" />
        <DataTableCell kind="number" value={12} format="percent" />
        <DataTableCell kind="number" value={130} format="currency" />
        <DataTableCell kind="number" value={1_234_567} format="compact" />
        <DataTableCell kind="number" value={512} format="compact" />
      </>,
    );
    const texts = [...container.querySelectorAll('span')].map(span => span.textContent);
    expect(texts).toEqual(['12,408', '38.20%', '12.00%', '$130.00', '1.2M', '512']);
  });

  it('formats time relatively with the absolute time to hand', () => {
    const date = new Date('2026-09-14T12:00:00.000Z');
    expect(formatRelative(date, date.getTime() + 3 * 60 * 60 * 1000)).toBe('3h ago');
    expect(formatRelative(date, date.getTime() + 40 * 24 * 60 * 60 * 1000)).toBe('1mo ago');
    expect(formatAbsolute(date)).toMatch(/^Sep 14, 2026 \d{2}:\d{2}$/);

    const { container } = render(
      <DataTableCell kind="time" date={date} mode="absolute" prefix="created" />,
    );
    expect(container.textContent).toMatch(/^createdSep 14, 2026/);
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(date.toISOString());
  });

  it('links out to one target directly and to several through a menu', () => {
    const { container, rerender } = render(
      <DataTableCell
        kind="link-out"
        label="GetCart"
        targets={[{ label: 'production', href: '/production' }]}
        tooltip="Open in Insights"
      />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/production');

    rerender(
      <DataTableCell
        kind="link-out"
        label="GetCart"
        targets={[
          { label: 'production', href: '/production' },
          { label: 'staging', href: '/staging' },
        ]}
        tooltip="Open in Insights"
      />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByLabelText('Open in Insights').tagName).toBe('BUTTON');
  });

  it('keeps a click on an action control from reaching the row', () => {
    const onRowClick = vi.fn();
    const columns: ColumnDef<Row, unknown>[] = [
      {
        id: 'actions',
        cell: () => (
          <DataTableCell kind="actions" label="Row actions" sections={[[{ label: 'Edit' }]]} />
        ),
      },
    ];
    render(
      <DataTable data={ROWS} columns={columns} getRowId={row => row.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('keeps a click on a link cell from reaching the row', () => {
    const onRowClick = vi.fn();
    const columns: ColumnDef<Row, unknown>[] = [
      {
        id: 'link',
        cell: ({ row }) => (
          <DataTableCell kind="link" label={row.original.name} href={`#${row.original.id}`} />
        ),
      },
    ];
    render(
      <DataTable data={ROWS} columns={columns} getRowId={row => row.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText('alpha'));
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('alpha').closest('td')!);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it('stripes data rows only, so an expanded panel does not shift the stripes', () => {
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        getRowId={row => row.id}
        renderSubComponent={row => <div>panel {row.original.name}</div>}
      />,
    );
    const dataRows = () =>
      [...container.querySelectorAll('tbody > tr')].filter(
        tr => !tr.textContent?.startsWith('panel'),
      );
    const striped = () => dataRows().map(tr => tr.className.includes('bg-neutral-2/60'));
    expect(striped()).toEqual([false, true, false]);

    fireEvent.click(dataRows()[0]);
    expect(container.textContent).toContain('panel alpha');
    expect(striped()).toEqual([false, true, false]);
  });

  it('tints a critical row and strikes through a name that no longer counts', () => {
    const columns: ColumnDef<Row, unknown>[] = [
      {
        id: 'who',
        cell: ({ row }) => (
          <DataTableCell
            kind="avatar"
            name={row.original.name}
            strikethrough={row.original.status === 'solved'}
          />
        ),
      },
    ];
    const { container } = render(
      <DataTable
        data={ROWS}
        columns={columns}
        getRowId={row => row.id}
        rowState={row => (row.status === 'solved' ? { critical: true } : undefined)}
      />,
    );
    const rows = [...container.querySelectorAll('tbody > tr')];
    expect(rows.map(tr => tr.className.includes('bg-critical-tint-subtle'))).toEqual([
      false,
      true,
      false,
    ]);
    // The second row would take the stripe; the critical tint replaces it.
    expect(rows[1].className).not.toContain('bg-neutral-2/60');
    expect(screen.getByText('beta').className).toContain('line-through');
    expect(screen.getByText('alpha').className).not.toContain('line-through');
  });

  it('shows only the label when a link-out cell has nowhere to go', () => {
    const { container } = render(
      <DataTableCell kind="link-out" label="GetCart" targets={[]} tooltip="Open in Insights" />,
    );
    expect(container.textContent).toBe('GetCart');
    expect(container.querySelector('a, button')).toBeNull();
  });

  it('collapses badges past the maximum into a +N badge', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(content => ({ content }));
    const { container } = render(<DataTableCell kind="badge" items={items} max={2} />);
    expect(container.textContent).toBe('ab+3');
  });

  it('lights at least one bar segment for any share above zero', () => {
    const lit = (container: HTMLElement) =>
      [...container.querySelectorAll('[role="meter"] span')].filter(segment =>
        segment.className.includes('bg-success'),
      ).length;
    const { container, rerender } = render(<DataTableCell kind="bar" value={0.09} max={100} />);
    expect(lit(container)).toBe(1);
    rerender(<DataTableCell kind="bar" value={0} max={100} />);
    expect(lit(container)).toBe(0);
    rerender(<DataTableCell kind="bar" value={55} max={100} />);
    expect(lit(container)).toBe(6);
  });

  it('renders a time as the day alone in date mode', () => {
    render(<DataTableCell kind="time" date="2026-09-15T09:30:00.000Z" mode="date" />);
    expect(screen.getByText(/Sep 15, 2026$/)).toBeTruthy();
  });

  it('renders a boolean as a check or a cross', () => {
    const { rerender } = render(<DataTableCell kind="boolean" value />);
    expect(screen.getByLabelText('Yes')).toBeTruthy();
    rerender(<DataTableCell kind="boolean" value={false} />);
    expect(screen.getByLabelText('No')).toBeTruthy();
  });

  it('renders the placeholder as an em dash', () => {
    const { container } = render(<DataTableCell kind="placeholder" />);
    expect(container.textContent).toBe('—');
  });
});
