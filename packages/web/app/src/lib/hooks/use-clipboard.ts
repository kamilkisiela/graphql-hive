import { useCallback } from 'react';
import { useNotifications } from './use-notifications';

export function useClipboard() {
  const notify = useNotifications();

  return useCallback(
    async (text: string): Promise<void> => {
      const result = await navigator.permissions.query({
        name: 'clipboard-write' as any,
      });

      if (result.state === 'denied') {
        notify('Access to clipboard rejected!', 'error');
        return;
      }
      // TODO: toast throws when used in Modal and modal's Portal is document.body
      const isV2 = window.location.pathname.startsWith('/v2');
      try {
        await navigator.clipboard.writeText(text);
        if (!isV2) {
          notify('Copied to clipboard!', 'info');
        }
      } catch (e) {
        if (!isV2) {
          notify('Failed to copy!', 'error');
        }
      }
    },
    [notify]
  );
}

// navigator.permissions.query({name: "clipboard-write"}).then(result => {
//   if (result.state == "granted" || result.state == "prompt") {
//     /* write to the clipboard now */
//   }
// });
