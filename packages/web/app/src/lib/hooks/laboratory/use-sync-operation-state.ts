import { useCurrentOperation } from './use-current-operation';

export function useSyncOperationState(props: {
  organizationId: string;
  projectId: string;
  targetId: string;
}): {
  savedOperation: { query: string; variables: string; updatedAt: number } | null;
  setSavedOperation: (value: { query: string; variables: string }) => void;
  clearOperation: () => void;
} {
  const currentOperation = useCurrentOperation({
    organizationId: props.organizationId,
    projectId: props.projectId,
    targetId: props.targetId,
  });
  const storageKey = currentOperation ? `hive:operation-${currentOperation?.id}` : null;
  const savedOperationData = storageKey ? localStorage.getItem(storageKey) : null;
  const operation = savedOperationData ? JSON.parse(savedOperationData) : null;

  const setSavedOperation = (value: { query: string; variables: string }) => {
    if (!storageKey) {
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify({ ...value, updatedAt: Date.now() }));
  };

  const clearOperation = () => {
    if (!storageKey) {
      return;
    }
    localStorage.removeItem(storageKey);
  };

  return {
    savedOperation: operation,
    setSavedOperation,
    clearOperation,
  };
}
