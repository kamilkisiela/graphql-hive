import { useCallback, useState } from 'react';

export function useOnClickOpener(openByDefault: boolean = false) {
  const [open, setOpen] = useState(openByDefault);
  const onClick = useCallback(() => setOpen(!open), [open, setOpen]);
  const onOpenChange = useCallback((isOpen: boolean) => setOpen(isOpen), [setOpen]);

  return {
    // open,
    // onOpenChange,
    // onClick,
    container: {
      open,
      onOpenChange,
    },
    trigger: {
      onClick,
    },
  };
}
