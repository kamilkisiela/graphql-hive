import type { LaboratoryOperation, LaboratoryTab } from '@graphql-hive/laboratory';
import { withLinkedOperation, type LaboratoryStoredState } from './laboratory-linked-operation';

const op = (id: string, query = `{ ${id} }`): LaboratoryOperation => ({
  id,
  name: id,
  query,
  variables: '{}',
  headers: '{}',
  extensions: '{}',
});

const tabFor = (operation: LaboratoryOperation, tabId = operation.id): LaboratoryTab => ({
  id: tabId,
  type: 'operation',
  data: { id: operation.id, name: operation.name },
});

const stored: LaboratoryStoredState = {
  operations: [op('a'), op('b')],
  tabs: [tabFor(op('a'), 'tab-a'), tabFor(op('b'))],
  activeTabId: 'b',
};

describe('withLinkedOperation', () => {
  it('returns the stored state untouched without a linked operation', () => {
    expect(withLinkedOperation(stored, null, 'id')).toBe(stored);
  });

  it('activates the existing tab of an operation matched by id', () => {
    const result = withLinkedOperation(stored, op('a', 'fresh copy'), 'id');

    expect(result.operations).toBe(stored.operations);
    expect(result.tabs).toBe(stored.tabs);
    expect(result.activeTabId).toBe('tab-a');
  });

  it('adds a tab for a stored operation that has none', () => {
    const result = withLinkedOperation({ ...stored, tabs: [] }, op('a'), 'id');

    expect(result.operations).toBe(stored.operations);
    expect(result.tabs).toEqual([tabFor(op('a'))]);
    expect(result.activeTabId).toBe('a');
  });

  it('appends an unknown operation with a tab and activates it', () => {
    const result = withLinkedOperation(stored, op('c'), 'id');

    expect(result.operations).toEqual([...stored.operations, op('c')]);
    expect(result.tabs).toEqual([...stored.tabs, tabFor(op('c'))]);
    expect(result.activeTabId).toBe('c');
  });

  it('reuses an operation with the same query when matching by content', () => {
    const result = withLinkedOperation(stored, op('random', '{ a }'), 'content');

    expect(result.operations).toBe(stored.operations);
    expect(result.activeTabId).toBe('tab-a');
  });

  it('appends a new query when matching by content', () => {
    const result = withLinkedOperation(stored, op('random', '{ c }'), 'content');

    expect(result.operations).toHaveLength(3);
    expect(result.activeTabId).toBe('random');
  });

  it('is idempotent', () => {
    const once = withLinkedOperation(stored, op('c'), 'id');
    const twice = withLinkedOperation(once, op('c'), 'id');

    expect(twice).toEqual(once);
  });
});
