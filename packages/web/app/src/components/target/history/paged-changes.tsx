import { useRef, type ReactElement, type ReactNode } from 'react';
import { DataTablePagination } from '@/components/ui/data-table/data-table-pagination';
import { Accordion } from '@/components/ui/primitives/accordion/accordion';
import { FragmentType, graphql, useFragment } from '@/gql';
import type { SchemaChangeKind } from '@/gql/graphql';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import { CHANGES_PAGE_SIZE } from './change-page-size';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeFragment,
  ChangesBlock_SchemaChangeWithUsageFragment,
  ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
  ChangesTitle,
} from './errors-and-changes';

export { CHANGES_PAGE_SIZE };

export const PagedChanges_SafeChangeGroupFragment = graphql(`
  fragment PagedChanges_SafeChangeGroupFragment on SchemaChangeGroup {
    kind
    totalCount
    changes(first: 300) {
      edges {
        node {
          ...ChangesBlock_SchemaChangeFragment
        }
      }
    }
  }
`);

type SafeChange = FragmentType<typeof ChangesBlock_SchemaChangeFragment>;
type BreakingChange = FragmentType<typeof ChangesBlock_SchemaChangeWithUsageFragment>;

/**
 * One page of a long change list at a time. Page 0 arrives with the check; the others load on
 * demand and are kept, so going back is instant. Until a page arrives the current one stays up.
 */
export function usePagedChanges<T>(args: {
  firstPage: T[];
  totalCount: number;
  loadPage: (offset: number) => Promise<T[]>;
  /** Pages belong to one list: a new key (another check or contract) starts over. */
  resetKey: string;
}) {
  const [pages, setPages] = useResetState(() => new Map<number, T[]>(), [args.resetKey]);
  const [pageIndex, setPageIndex] = useResetState(() => 0, [args.resetKey]);
  const [loading, setLoading] = useResetState(() => false, [args.resetKey]);
  const [failed, setFailed] = useResetState(() => false, [args.resetKey]);
  // Only the newest request may switch the page, and only within the list it was made for.
  const latest = useRef<{ key: string; index: number } | null>(null);
  const currentKey = useRef(args.resetKey);
  currentKey.current = args.resetKey;

  function goTo(index: number) {
    const request = { key: args.resetKey, index };
    latest.current = request;
    setFailed(false);
    if (index === 0 || pages.has(index)) {
      setLoading(false);
      setPageIndex(index);
      return;
    }
    setLoading(true);
    args.loadPage(index * CHANGES_PAGE_SIZE).then(
      rows => {
        if (currentKey.current !== request.key) {
          return;
        }
        setPages(current => new Map(current).set(index, rows));
        if (latest.current === request) {
          setPageIndex(index);
          setLoading(false);
        }
      },
      () => {
        if (currentKey.current === request.key && latest.current === request) {
          setLoading(false);
          setFailed(true);
        }
      },
    );
  }

  return {
    rows: pageIndex === 0 ? args.firstPage : (pages.get(pageIndex) ?? args.firstPage),
    pageIndex,
    pageCount: Math.ceil(args.totalCount / CHANGES_PAGE_SIZE),
    loading,
    failed,
    goTo,
  };
}

function PageControls(props: {
  paging: ReturnType<typeof usePagedChanges<unknown>>;
  children: ReactNode;
}) {
  const { paging } = props;
  return (
    <div className="flex flex-col gap-3">
      <div
        aria-busy={paging.loading}
        className={cn('transition-opacity', paging.loading && 'opacity-50')}
      >
        {props.children}
      </div>
      {paging.failed ? (
        <p className="text-xs text-critical">This page could not be loaded. Try again.</p>
      ) : null}
      <DataTablePagination
        pageIndex={paging.pageIndex}
        pageCount={paging.pageCount}
        onPageChange={paging.goTo}
      />
    </div>
  );
}

const formatTotal = (count: number) => count.toLocaleString('en-US');

export function CountedTitle(props: { children: ReactNode; count: number }) {
  return (
    <>
      {props.children}{' '}
      <span className="font-normal text-fg-muted">· {formatTotal(props.count)}</span>
    </>
  );
}

export function PagedBreakingChanges(props: {
  title: ReactElement;
  firstPage: BreakingChange[];
  totalCount: number;
  loadPage: (offset: number) => Promise<BreakingChange[]>;
  resetKey: string;
  schemaCheckId: string;
  conditionBreakingChangeMetadata: FragmentType<
    typeof ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment
  > | null;
}) {
  const paging = usePagedChanges(props);
  return (
    <PageControls paging={paging}>
      <ChangesBlock
        schemaCheckId={props.schemaCheckId}
        title={<CountedTitle count={props.totalCount}>{props.title}</CountedTitle>}
        changesWithUsage={paging.rows}
        conditionBreakingChangeMetadata={props.conditionBreakingChangeMetadata}
      />
    </PageControls>
  );
}

/** "TYPE_DESCRIPTION_CHANGED" reads as "Type description changed". */
export function changeKindLabel(kind: string) {
  const words = kind.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function SafeChangeGroupPage(props: {
  kind: SchemaChangeKind;
  firstPage: SafeChange[];
  totalCount: number;
  loadPage: (kind: SchemaChangeKind, offset: number) => Promise<SafeChange[]>;
  resetKey: string;
  schemaCheckId: string;
}) {
  const paging = usePagedChanges({
    firstPage: props.firstPage,
    totalCount: props.totalCount,
    loadPage: offset => props.loadPage(props.kind, offset),
    resetKey: `${props.resetKey}:${props.kind}`,
  });
  return (
    <PageControls paging={paging}>
      <ChangesBlock schemaCheckId={props.schemaCheckId} changes={paging.rows} />
    </PageControls>
  );
}

/** Safe changes by kind, smallest group first, each group paged on its own. */
export function SafeChangeGroups(props: {
  groups: FragmentType<typeof PagedChanges_SafeChangeGroupFragment>[];
  loadPage: (kind: SchemaChangeKind, offset: number) => Promise<SafeChange[]>;
  resetKey: string;
  schemaCheckId: string;
}) {
  const groups = useFragment(PagedChanges_SafeChangeGroupFragment, props.groups);
  if (!groups.length) {
    return null;
  }
  const total = groups.reduce((sum, group) => sum + group.totalCount, 0);
  return (
    <div>
      <ChangesTitle>
        <CountedTitle count={total}>Safe Changes</CountedTitle>
      </ChangesTitle>
      <Accordion
        variant="boxed"
        multiple
        items={groups.map(group => ({
          value: group.kind,
          label: changeKindLabel(group.kind),
          trailing: <span className="text-xs text-fg-muted">{formatTotal(group.totalCount)}</span>,
          content: (
            <SafeChangeGroupPage
              kind={group.kind}
              firstPage={group.changes.edges.map(edge => edge.node)}
              totalCount={group.totalCount}
              loadPage={props.loadPage}
              resetKey={props.resetKey}
              schemaCheckId={props.schemaCheckId}
            />
          ),
        }))}
      />
    </div>
  );
}
