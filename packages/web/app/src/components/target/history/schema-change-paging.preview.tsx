import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { FileDiffIcon, ListIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import {
  DataTableCursorPagination,
  DataTablePagination,
} from '@/components/ui/data-table/data-table-pagination';
import { Accordion } from '@/components/ui/primitives/accordion/accordion';
import { Button } from '@/components/ui/primitives/button/button';
import { Input } from '@/components/ui/primitives/input/input';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { makeFragmentData } from '@/gql';
import { SeverityLevelType } from '@/gql/graphql';
import { RouterAt } from '../../../../foundry.router';
import { buildChanges, metadata, PATH } from './changes-block.fixtures';
import { ChangesBlock, ChangesBlock_SchemaChangeFragment } from './errors-and-changes';

export const nav: NavPath = 'Components/SchemaChangePaging';

/**
 * Ways to page a check's schema changes, for checks like the Wealthsimple one: a few breaking
 * changes and thousands of safe ones, mostly description edits. Each option renders the real
 * `ChangesBlock` in the Details tab as the check page lays it out, breaking changes as #8679's cards
 * above the safe changes. Only the controls around the safe list are proposals. The breaking title
 * is plain text here, as in the ChangesBlock preview; the page adds an info popover to it.
 */

const PAGE_SIZE = 50;
const format = (count: number) => count.toLocaleString('en-US');

type ChangeKind = 'description' | 'field' | 'type';

// Inspector's message templates, which is what the API serves as `message`.
function safeChangeAt(index: number, kind: ChangeKind) {
  const type = `StressType_${index + 1}`;
  const message =
    kind === 'description'
      ? `Description 'Stress type ${index + 1}, used to test large schemas.' on type '${type}' has changed to 'Stress type ${index + 1}, used to test large schemas (revised).'`
      : kind === 'field'
        ? `Field 'value8' was added to object type '${type}'`
        : `Type 'NewThing${index + 1}' was added`;
  return makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      path: kind === 'field' ? [type, 'value8'] : [type],
      message,
      severityLevel: SeverityLevelType.Safe,
      severityReason: null,
      approval: null,
      isSafeBasedOnUsage: false,
    },
    ChangesBlock_SchemaChangeFragment,
  );
}

function useSafeChanges(total: number, kind: ChangeKind = 'description') {
  return useMemo(
    () => Array.from({ length: total }, (_, index) => safeChangeAt(index, kind)),
    [total, kind],
  );
}

function CountedTitle(props: { label: string; total: number }) {
  return (
    <>
      {props.label} <span className="font-normal text-fg-muted">· {format(props.total)}</span>
    </>
  );
}

/** The Details tab as the check page renders it: breaking changes, then the safe changes body. */
function DetailsTab(props: { caption: ReactNode; counted?: boolean; children: ReactNode }) {
  const { targets, changes } = buildChanges({
    usedTargets: 2,
    unusedTargets: 9,
    operations: 2,
    legacy: false,
  });
  return (
    <RouterAt path={PATH}>
      <div className="flex w-[72rem] flex-col gap-4">
        <p className="max-w-prose text-xs text-fg-secondary">{props.caption}</p>
        <TabbedView
          defaultValue="details"
          bodyPadding="none"
          items={[
            {
              value: 'details',
              label: 'Details',
              icon: ListIcon,
              content: (
                <div className="p-5">
                  <div className="mb-5">
                    <ChangesBlock
                      schemaCheckId="check-1"
                      title={
                        props.counted === false ? (
                          'Breaking Changes'
                        ) : (
                          <CountedTitle label="Breaking Changes" total={changes.length} />
                        )
                      }
                      changesWithUsage={changes}
                      conditionBreakingChangeMetadata={metadata(targets)}
                    />
                  </div>
                  <div className="mb-5">{props.children}</div>
                </div>
              ),
            },
            { value: 'service', label: 'Service', icon: FileDiffIcon, content: null },
            { value: 'public', label: 'Public Schema', icon: FileDiffIcon, content: null },
            { value: 'supergraph', label: 'Supergraph', icon: FileDiffIcon, content: null },
            { value: 'policy', label: 'Policy', icon: TriangleAlertIcon, content: null },
          ]}
        />
      </div>
    </RouterAt>
  );
}

/** "Show N more" under a list, appending the next page in place. */
function ShowMoreButton(props: { loaded: number; total: number; onLoaded: () => void }) {
  const [loading, setLoading] = useState(false);
  const remaining = props.total - props.loaded;
  if (remaining <= 0) {
    return null;
  }
  return (
    <Button
      variant="outline"
      width="full"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        // Stands in for the request for the next page.
        setTimeout(() => {
          setLoading(false);
          props.onLoaded();
        }, 600);
      }}
    >
      {loading ? <Spinner variants={{ size: 'xs' }} label="Loading more changes" /> : null}
      Show {Math.min(PAGE_SIZE, remaining)} more
      <span className="text-fg-muted">· {format(remaining)} remaining</span>
    </Button>
  );
}

/** A safe list that loads a page at a time. */
function PagedSafeList(props: { title?: ReactElement; kind?: ChangeKind; total: number }) {
  const [loaded, setLoaded] = useState(PAGE_SIZE);
  const changes = useSafeChanges(Math.min(loaded, props.total), props.kind);
  return (
    <div className="flex flex-col gap-3">
      <ChangesBlock
        schemaCheckId="check-1"
        title={props.title}
        changes={changes}
      />
      <ShowMoreButton
        loaded={changes.length}
        total={props.total}
        onLoaded={() => setLoaded(count => count + PAGE_SIZE)}
      />
    </div>
  );
}

function TodayView(props: { rendered: number }) {
  const changes = useSafeChanges(props.rendered);
  return (
    <DetailsTab
      counted={false}
      caption="Today: every change is fetched with the check and rendered at once. The real check has 5,000 safe changes; this renders as many as the control asks, so raise it to feel the cost."
    >
      <ChangesBlock schemaCheckId="check-1" title="Safe Changes" changes={changes} />
    </DetailsTab>
  );
}

export const Today = createPreview({
  controls: controlsFor(TodayView, {
    rendered: { type: 'number', default: 200 },
  }),
  render: v => <TodayView rendered={v.rendered} />,
});

const GROUPS: { kind: ChangeKind; label: string; total: number }[] = [
  { kind: 'type', label: 'Types added', total: 5 },
  { kind: 'field', label: 'Fields added', total: 12 },
  { kind: 'description', label: 'Descriptions changed', total: 4983 },
];

function GroupedView(props: { groupStyle: 'boxed' | 'list' }) {
  const total = GROUPS.reduce((sum, group) => sum + group.total, 0);
  return (
    <DetailsTab caption="Breaking changes stay one card each, since each needs its own review. Safe changes are grouped by kind, each group paged with Show more, so 5 added types are not buried among 4,983 description edits. Switch the group style to compare boxed groups against the breaking cards above. Needs each change's kind from the API, which the check page does not fetch today.">
      <h2 className="mb-3 font-bold text-fg-default">
        <CountedTitle label="Safe Changes" total={total} />
      </h2>
      <Accordion
        variant={props.groupStyle}
        multiple
        defaultValue={['type']}
        items={GROUPS.map(group => ({
          value: group.kind,
          label: group.label,
          trailing: <span className="text-xs text-fg-muted">{format(group.total)}</span>,
          content: <PagedSafeList kind={group.kind} total={group.total} />,
        }))}
      />
    </DetailsTab>
  );
}

export const Grouped = createPreview({
  controls: controlsFor(GroupedView, {
    groupStyle: { type: 'radio', options: ['boxed', 'list'], default: 'boxed' },
  }),
  render: v => <GroupedView groupStyle={v.groupStyle} />,
});

function ShowMoreView(props: { total: number }) {
  return (
    <DetailsTab caption='Ungrouped: the header carries the total, the first 50 load with the check, and "Show 50 more" appends the next page in place. Sections below (policy errors and warnings) stay one scroll away.'>
      <PagedSafeList title={<CountedTitle label="Safe Changes" total={props.total} />} total={props.total} />
    </DetailsTab>
  );
}

export const ShowMore = createPreview({
  controls: controlsFor(ShowMoreView, {
    total: { type: 'number', default: 5000 },
  }),
  render: v => <ShowMoreView total={v.total} />,
});

function WithFilterView(props: { total: number }) {
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(PAGE_SIZE);
  const all = useSafeChanges(props.total);
  // The real filter would be an API argument; this filters the fixture in place.
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((_, index) => `stresstype_${index + 1}`.includes(needle)) : all;
  }, [all, query]);
  const changes = matching.slice(0, loaded);
  return (
    <DetailsTab caption="Show more, plus a filter by coordinate, so finding one change does not depend on Ctrl+F (which cannot see unloaded or virtualized rows). Try StressType_12.">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-72">
            <Input
              size="compact"
              width="full"
              leadingIcon={SearchIcon}
              placeholder="Filter by coordinate"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setLoaded(PAGE_SIZE);
              }}
            />
          </div>
          {query.trim() ? (
            <span className="text-xs text-fg-secondary">
              {format(matching.length)} of {format(props.total)} match
            </span>
          ) : null}
        </div>
        <ChangesBlock
          schemaCheckId="check-1"
          title={<CountedTitle label="Safe Changes" total={matching.length} />}
          changes={changes}
        />
        <ShowMoreButton
          loaded={changes.length}
          total={matching.length}
          onLoaded={() => setLoaded(count => count + PAGE_SIZE)}
        />
      </div>
    </DetailsTab>
  );
}

export const WithFilter = createPreview({
  controls: controlsFor(WithFilterView, {
    total: { type: 'number', default: 5000 },
  }),
  render: v => <WithFilterView total={v.total} />,
});

function PreviousNextView(props: { total: number }) {
  const [page, setPage] = useState(0);
  const all = useSafeChanges(props.total);
  const first = page * PAGE_SIZE;
  const changes = all.slice(first, first + PAGE_SIZE);
  return (
    <DetailsTab caption="The existing DataTableCursorPagination (the Apps page's control): one page at a time, with previous and next. Reviewing means paging through; earlier pages are gone once you move on.">
      <div className="flex flex-col gap-3">
        <ChangesBlock
          schemaCheckId="check-1"
          title={<CountedTitle label="Safe Changes" total={props.total} />}
          changes={changes}
        />
        <DataTableCursorPagination
          hasPreviousPage={page > 0}
          hasNextPage={first + PAGE_SIZE < props.total}
          onPrevious={() => setPage(current => current - 1)}
          onNext={() => setPage(current => current + 1)}
          summary={`Showing ${format(first + 1)}–${format(first + changes.length)} of ${format(props.total)} safe changes`}
        />
      </div>
    </DetailsTab>
  );
}

export const PreviousNext = createPreview({
  controls: controlsFor(PreviousNextView, {
    total: { type: 'number', default: 5000 },
  }),
  render: v => <PreviousNextView total={v.total} />,
});

function NumberedPagesView(props: { total: number }) {
  const [page, setPage] = useState(0);
  const all = useSafeChanges(props.total);
  const changes = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return (
    <DetailsTab caption="The existing DataTablePagination: numbered pages with a jump field. Needs offsets from the API (the changes are one stored array, so it can serve them), but 100 pages of review list is a lot to navigate.">
      <div className="flex flex-col gap-3">
        <ChangesBlock
          schemaCheckId="check-1"
          title={<CountedTitle label="Safe Changes" total={props.total} />}
          changes={changes}
        />
        <DataTablePagination
          pageIndex={page}
          pageCount={Math.ceil(props.total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      </div>
    </DetailsTab>
  );
}

export const NumberedPages = createPreview({
  controls: controlsFor(NumberedPagesView, {
    total: { type: 'number', default: 5000 },
  }),
  render: v => <NumberedPagesView total={v.total} />,
});

function InfiniteScrollView(props: { total: number }) {
  const changes = useSafeChanges(Math.min(PAGE_SIZE, props.total));
  return (
    <DetailsTab caption="Infinite scroll, shown at the moment it reaches the end of a page: the next page loads on its own. No button to press, but policy errors and warnings below the list stay out of reach until all 5,000 have streamed in.">
      <div className="flex flex-col gap-3">
        <ChangesBlock
          schemaCheckId="check-1"
          title={<CountedTitle label="Safe Changes" total={props.total} />}
          changes={changes}
        />
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-fg-secondary">
          <Spinner variants={{ size: 'xs' }} label="Loading more changes" />
          Loading more changes…
        </div>
      </div>
    </DetailsTab>
  );
}

export const InfiniteScroll = createPreview({
  controls: controlsFor(InfiniteScrollView, {
    total: { type: 'number', default: 5000 },
  }),
  render: v => <InfiniteScrollView total={v.total} />,
});
