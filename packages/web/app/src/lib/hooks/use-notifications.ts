import { useCallback } from 'react';
import { toast } from 'react-toastify';

export function useNotifications() {
  // const toast = useToast({
  //   isClosable: true,
  //   duration: 5000,
  //   position: 'bottom-right',
  // });

  return useCallback(
    (title: string, type: 'success' | 'error' | 'warning' | 'info') =>
      toast(title, {
        type,
        position: toast.POSITION.BOTTOM_RIGHT,
        theme: 'dark',
      }),
    [],
  );
}
