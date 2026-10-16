import type { SchemaChangeMapper } from '../../module.graphql.mappers';
import {
  countUnapprovedBreakingChanges,
  groupSchemaChangesByKind,
  pageSchemaChanges,
  toSchemaChangePage,
} from '../schema-change-pages.js';

function change(
  type: string,
  index: number,
  overrides: { approved?: boolean; safeBasedOnUsage?: boolean } = {},
) {
  return {
    id: `${type}-${index}`,
    type,
    approvalMetadata: overrides.approved
      ? { schemaCheckId: 'check', date: '', userId: null }
      : null,
    isSafeBasedOnUsage: overrides.safeBasedOnUsage ?? false,
  } as unknown as SchemaChangeMapper;
}

const changes = Array.from({ length: 120 }, (_, index) => change('FIELD_REMOVED', index));

describe('pageSchemaChanges', () => {
  it('returns every change from the offset without first, as callers without paging expect', () => {
    expect(pageSchemaChanges(changes, {}).page).toHaveLength(120);
    expect(pageSchemaChanges(changes, { offset: 100 }).page).toHaveLength(20);
  });

  it('slices a page and keeps the full count', () => {
    const page = pageSchemaChanges(changes, { first: 50, offset: 50 });

    expect(page.page.map(change => change.id)).toEqual(
      changes.slice(50, 100).map(change => change.id),
    );
    expect(page.offset).toBe(50);
    expect(page.totalCount).toBe(120);
  });

  it('returns a short last page and an empty page past the end', () => {
    expect(pageSchemaChanges(changes, { first: 50, offset: 100 }).page).toHaveLength(20);
    expect(pageSchemaChanges(changes, { first: 50, offset: 500 }).page).toHaveLength(0);
  });

  it('treats a negative offset as the start', () => {
    expect(pageSchemaChanges(changes, { first: 1, offset: -5 }).offset).toBe(0);
  });
});

describe('toSchemaChangePage', () => {
  it('reads a plain array as one page holding everything', () => {
    expect(toSchemaChangePage(changes)).toEqual({ page: changes, offset: 0, totalCount: 120 });
  });
});

describe('groupSchemaChangesByKind', () => {
  it('groups by change type, smallest group first, ties by kind', () => {
    const groups = groupSchemaChangesByKind([
      ...Array.from({ length: 3 }, (_, index) => change('TYPE_DESCRIPTION_CHANGED', index)),
      change('TYPE_ADDED', 0),
      change('FIELD_ADDED', 0),
    ]);

    expect(groups.map(group => [group.kind, group.changes.length])).toEqual([
      ['FIELD_ADDED', 1],
      ['TYPE_ADDED', 1],
      ['TYPE_DESCRIPTION_CHANGED', 3],
    ]);
  });

  it('keeps the stored order within a group', () => {
    const [group] = groupSchemaChangesByKind([change('FIELD_ADDED', 2), change('FIELD_ADDED', 1)]);

    expect(group.changes.map(change => change.id)).toEqual(['FIELD_ADDED-2', 'FIELD_ADDED-1']);
  });
});

describe('countUnapprovedBreakingChanges', () => {
  it('skips approved changes and changes safe based on usage', () => {
    expect(
      countUnapprovedBreakingChanges([
        change('FIELD_REMOVED', 0),
        change('FIELD_REMOVED', 1, { approved: true }),
        change('FIELD_REMOVED', 2, { safeBasedOnUsage: true }),
      ]),
    ).toBe(1);
    expect(countUnapprovedBreakingChanges(null)).toBe(0);
  });
});
