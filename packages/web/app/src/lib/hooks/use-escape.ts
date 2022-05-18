import { useEventListener } from './use-event-listener';

export function useEscape(cb: () => void) {
  useEventListener('keydown', (event: KeyboardEvent) => {
    const key = event.key ?? event.keyCode;

    if (key === 'Escape' || key === 'Esc' || key === 27) {
      cb();
    }
  });
}
