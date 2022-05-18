import React from 'react';
import { useNotifications } from './use-notifications';

export function useClipboard() {
  const notify = useNotifications();
  const copy = React.useCallback(
    (text: string) => {
      navigator.permissions
        .query({ name: 'clipboard-write' as any })
        .then((result) => {
          if (result.state === 'denied') {
            notify('Access to clipboad rejected!', 'error');
          } else {
            navigator.clipboard.writeText(text).then(
              () => {
                notify('Copied to clipboard!', 'info');
              },
              () => {
                notify('Failed to copy!', 'error');
              }
            );
          }
        });
    },
    [notify]
  );

  return copy;
}

// navigator.permissions.query({name: "clipboard-write"}).then(result => {
//   if (result.state == "granted" || result.state == "prompt") {
//     /* write to the clipboard now */
//   }
// });
