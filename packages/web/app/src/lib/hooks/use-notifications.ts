import { useCallback } from 'react';
import { toast } from 'react-toastify';

export function useNotifications() {
  return useCallback(
    (title: string, type: 'success' | 'error' | 'warning' | 'info') =>
      toast(title, {
        type,
        position: 'bottom-right',
        theme: 'dark',
      }),
    [],
  );
}
