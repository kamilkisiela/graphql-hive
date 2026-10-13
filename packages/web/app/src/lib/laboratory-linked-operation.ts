import type {
  LaboratoryOperation,
  LaboratoryTab,
  LaboratoryTabOperation,
} from '@graphql-hive/laboratory';

const isOperationTab = (tab: LaboratoryTab): tab is LaboratoryTabOperation =>
  tab.type === 'operation';

export interface LaboratoryStoredState {
  operations: LaboratoryOperation[];
  tabs: LaboratoryTab[];
  activeTabId: string | null;
}

// A link opens its operation once: an existing copy is reused and its tab activated, otherwise
// the operation and a tab are appended.
export function withLinkedOperation(
  stored: LaboratoryStoredState,
  incoming: LaboratoryOperation | null,
  matchBy: 'id' | 'content',
): LaboratoryStoredState {
  if (!incoming) {
    return stored;
  }

  const existing = stored.operations.find(operation =>
    matchBy === 'id' ? operation.id === incoming.id : operation.query === incoming.query,
  );
  const operation = existing ?? incoming;
  const operations = existing ? stored.operations : [...stored.operations, incoming];

  const existingTab = stored.tabs.find(tab => isOperationTab(tab) && tab.data.id === operation.id);
  const tab: LaboratoryTab = existingTab ?? {
    id: operation.id,
    type: 'operation',
    data: { id: operation.id, name: operation.name },
  };
  const tabs = existingTab ? stored.tabs : [...stored.tabs, tab];

  return { operations, tabs, activeTabId: tab.id };
}
