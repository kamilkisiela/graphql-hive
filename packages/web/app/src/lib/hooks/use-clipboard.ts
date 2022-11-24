import { useCallback } from 'react';
import { useNotifications } from './use-notifications';

export function useClipboard() {
  const notify = useNotifications();

  return useCallback(
    async (text: string): Promise<void> => {
      if (!navigator?.clipboard) {
        notify('Access to clipboard rejected!', 'error');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        notify('Copied to clipboard!', 'info');
      } catch {
        notify('Failed to copy!', 'error');
      }
    },
    [notify],
  );
}
