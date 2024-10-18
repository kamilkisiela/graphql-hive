import { useCurrentOperation } from './use-current-operation';

export function useSyncOperationState(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}): {
  savedOperation: { query: string; variables: string; updatedAt: number } | null;
  setSavedOperation: (value: { query: string; variables: string }) => void;
  clearOperation: () => void;
} {
  const currentOperation = useCurrentOperation({
    organizationSlug: props.organizationSlug,
    projectSlug: props.projectSlug,
    targetSlug: props.targetSlug,
  });
  const storageKey = currentOperation ? `hive:operation-${currentOperation.id}` : null;
  const savedOperationData = storageKey ? localStorage.getItem(storageKey) : null;

  return {
    savedOperation: savedOperationData ? JSON.parse(savedOperationData) : null,
    setSavedOperation(value: { query: string; variables: string }) {
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify({ ...value, updatedAt: Date.now() }));
      }
    },
    clearOperation() {
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
    },
  };
}
