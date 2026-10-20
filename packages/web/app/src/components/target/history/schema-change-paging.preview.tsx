import { useMemo, type ReactNode } from 'react';
import { FileDiffIcon, ListIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { makeFragmentData } from '@/gql';
import { SchemaChangeKind, SeverityLevelType } from '@/gql/graphql';
import { RouterAt } from '../../../../foundry.router';
import { buildChanges, metadata, PATH } from './changes-block.fixtures';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeFragment,
  ChangesBlock_SchemaChangeWithUsageFragment,
} from './errors-and-changes';
import {
  CHANGES_PAGE_SIZE,
  PagedBreakingChanges,
  PagedChanges_SafeChangeGroupFragment,
  SafeChangeGroups,
} from './paged-changes';

export const nav: NavPath = 'Components/SchemaChangePaging';

/**
 * A check's changes as the Details tab shows them: breaking changes as #8679's cards, safe
 * changes grouped by kind, each list paged 50 at a time. These are the real components with the
 * page requests stood in for by a short delay. The breaking title is plain text here; the page
 * adds an info popover to it.
 */

const LOAD_DELAY_MS = 400;

type SafeKind =
  | SchemaChangeKind.TypeDescriptionChanged
  | SchemaChangeKind.FieldAdded
  | SchemaChangeKind.TypeAdded;

// Inspector's message templates, which is what the API serves as `message`.
function safeChangeAt(kind: SafeKind, index: number) {
  const type = `StressType_${index + 1}`;
  const message =
    kind === SchemaChangeKind.TypeDescriptionChanged
      ? `Description 'Stress type ${index + 1}, used to test large schemas.' on type '${type}' has changed to 'Stress type ${index + 1}, used to test large schemas (revised).'`
      : kind === SchemaChangeKind.FieldAdded
        ? `Field 'value8' was added to object type '${type}'`
        : `Type 'NewThing${index + 1}' was added`;
  return makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      path: kind === SchemaChangeKind.FieldAdded ? [type, 'value8'] : [type],
      message,
      severityLevel: SeverityLevelType.Safe,
      severityReason: null,
      approval: null,
      isSafeBasedOnUsage: false,
      isUsageTracked: false,
      kind,
    },
    ChangesBlock_SchemaChangeFragment,
  );
}

// A removal stored before per-target usage was kept: a card without usage panels.
function breakingChangeAt(index: number) {
  return makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      path: [`StressType_${index + 1}`, 'value7'],
      message: `Field 'value7' was removed from object type 'StressType_${index + 1}'`,
      severityLevel: SeverityLevelType.Breaking,
      severityReason:
        'Removing a field is a breaking change. It is preferable to deprecate the field before removing it. This applies to removed union fields as well, since removal breaks client operations that contain fragments that reference the removed type through direct (... on RemovedType) or indirect means such as __typename in the consumers.',
      isSafeBasedOnUsage: false,
      isUsageTracked: true,
      kind: SchemaChangeKind.FieldRemoved,
      approval: null,
      usageStatistics: null,
      affectedAppDeployments: null,
    },
    ChangesBlock_SchemaChangeWithUsageFragment,
  );
}

function range<T>(offset: number, count: number, at: (index: number) => T) {
  return Array.from({ length: Math.max(0, count) }, (_, index) => at(offset + index));
}

const delay = <T,>(value: T) =>
  new Promise<T>(resolve => setTimeout(() => resolve(value), LOAD_DELAY_MS));

/** The Details tab around a body, as the check page renders it. */
function DetailsTab(props: { children: ReactNode }) {
  return (
    <RouterAt path={PATH}>
      <div className="w-[72rem]">
        <TabbedView
          defaultValue="details"
          bodyPadding="none"
          items={[
            {
              value: 'details',
              label: 'Details',
              icon: ListIcon,
              content: <div className="p-5">{props.children}</div>,
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

const usage = buildChanges({ usedTargets: 2, unusedTargets: 9, operations: 2, legacy: false });

function TodayView(props: { rendered: number }) {
  const changes = useMemo(
    () =>
      range(0, props.rendered, index =>
        safeChangeAt(SchemaChangeKind.TypeDescriptionChanged, index),
      ),
    [props.rendered],
  );
  return (
    <DetailsTab>
      <div className="mb-5">
        <ChangesBlock
          schemaCheckId="check-1"
          title="Breaking Changes"
          changesWithUsage={usage.changes}
          conditionBreakingChangeMetadata={metadata(usage.targets)}
        />
      </div>
      <div className="mb-5">
        <ChangesBlock schemaCheckId="check-1" title="Safe Changes" changes={changes} />
      </div>
    </DetailsTab>
  );
}

/** Before: every change fetched and rendered at once. Raise the count to feel the cost. */
export const Today = createPreview({
  controls: controlsFor(TodayView, {
    rendered: { type: 'number', default: 200 },
  }),
  render: v => <TodayView rendered={v.rendered} />,
});

function GroupedView(props: { breaking: number; descriptions: number }) {
  // The rich cards from the ChangesBlock preview first, then plain removals up to the total.
  const breakingAt = (index: number) =>
    index < usage.changes.length ? usage.changes[index] : breakingChangeAt(index);
  const groups: { kind: SafeKind; totalCount: number }[] = [
    { kind: SchemaChangeKind.FieldAdded, totalCount: 5 },
    { kind: SchemaChangeKind.TypeAdded, totalCount: 5 },
    { kind: SchemaChangeKind.TypeDescriptionChanged, totalCount: props.descriptions },
  ];
  return (
    <DetailsTab>
      {props.breaking > 0 ? (
        <div className="mb-5">
          <PagedBreakingChanges
            schemaCheckId="check-1"
            title={<>Breaking Changes</>}
            firstPage={range(0, Math.min(CHANGES_PAGE_SIZE, props.breaking), breakingAt)}
            totalCount={props.breaking}
            loadPage={offset =>
              delay(range(offset, Math.min(CHANGES_PAGE_SIZE, props.breaking - offset), breakingAt))
            }
            resetKey={`breaking-${props.breaking}`}
            conditionBreakingChangeMetadata={metadata(usage.targets)}
          />
        </div>
      ) : null}
      <div className="mb-5">
        <SafeChangeGroups
          schemaCheckId="check-1"
          resetKey={`safe-${props.descriptions}`}
          groups={groups.map(group =>
            makeFragmentData(
              {
                __typename: 'SchemaChangeGroup' as const,
                kind: group.kind,
                totalCount: group.totalCount,
                changes: {
                  __typename: 'SchemaChangeConnection' as const,
                  edges: range(0, Math.min(CHANGES_PAGE_SIZE, group.totalCount), index => ({
                    __typename: 'SchemaChangeEdge' as const,
                    node: {
                      __typename: 'SchemaChange' as const,
                      ...safeChangeAt(group.kind, index),
                    },
                  })),
                },
              },
              PagedChanges_SafeChangeGroupFragment,
            ),
          )}
          loadPage={(kind, offset) => {
            const total = groups.find(group => group.kind === kind)?.totalCount ?? 0;
            return delay(
              range(offset, Math.min(CHANGES_PAGE_SIZE, total - offset), index =>
                safeChangeAt(kind as SafeKind, index),
              ),
            );
          }}
        />
      </div>
    </DetailsTab>
  );
}

/** After: breaking cards and safe groups, each list paged 50 at a time. */
export const Grouped = createPreview({
  controls: controlsFor(GroupedView, {
    breaking: { type: 'number', label: 'Breaking changes', default: 120 },
    descriptions: { type: 'number', label: 'Description changes', default: 4983 },
  }),
  render: v => <GroupedView breaking={v.breaking} descriptions={v.descriptions} />,
});
