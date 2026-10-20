import type {
  SchemaChangeConnectionMapper,
  SchemaChangeGroupMapper,
  SchemaChangeMapper,
  SchemaChangePage,
} from '../module.graphql.mappers';
import type { Change } from '@hive/storage';

/**
 * A slice of a check's changes. Without `first` it is everything from `offset`, so callers that
 * pass no paging arguments get the whole list, as they always have.
 */
export function pageSchemaChanges(
  changes: ReadonlyArray<SchemaChangeMapper>,
  args: { first?: number | null; offset?: number | null },
): SchemaChangePage {
  const offset = Math.max(0, args.offset ?? 0);
  const end = args.first == null ? undefined : offset + Math.max(0, args.first);
  return { page: changes.slice(offset, end), offset, totalCount: changes.length };
}

export function toSchemaChangePage(connection: SchemaChangeConnectionMapper): SchemaChangePage {
  return 'page' in connection
    ? connection
    : { page: connection, offset: 0, totalCount: connection.length };
}

/** Groups by Inspector change type, smallest group first so rare kinds are not buried. */
export function groupSchemaChangesByKind(
  changes: ReadonlyArray<SchemaChangeMapper>,
): SchemaChangeGroupMapper[] {
  const groups = new Map<Change['type'], SchemaChangeMapper[]>();
  for (const change of changes) {
    // Read through SchemaChangeModel, so the type is one of its kinds; the transform widens it.
    const kind = change.type as Change['type'];
    const group = groups.get(kind);
    if (group) {
      group.push(change);
    } else {
      groups.set(kind, [change]);
    }
  }
  return Array.from(groups, ([kind, kindChanges]) => ({ kind, changes: kindChanges })).sort(
    (a, b) =>
      a.changes.length - b.changes.length || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0),
  );
}

export function countUnapprovedBreakingChanges(
  changes: ReadonlyArray<SchemaChangeMapper> | null | undefined,
) {
  return (
    changes?.filter(change => change.approvalMetadata === null && !change.isSafeBasedOnUsage)
      .length ?? 0
  );
}

export function encodeSchemaChangeCursor(index: number) {
  return Buffer.from(String(index)).toString('base64');
}
