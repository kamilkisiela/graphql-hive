import { useEffect, useMemo } from 'react';
import { useToggle } from '@/lib/hooks';

export function useCommand() {
  const [isCommandOpen, toggleCommandOpen] = useToggle();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandOpen();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggleCommandOpen]);

  const controller = useMemo(
    () => ({
      isOpen: isCommandOpen,
      toggle: toggleCommandOpen,
    }),
    [isCommandOpen, toggleCommandOpen],
  );

  return controller;
}
