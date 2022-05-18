import { useEffect } from 'react';
import { track } from '@/lib/mixpanel';

export function useTracker(event: string, condition = true) {
  useEffect(() => {
    if (condition) {
      track(event);
    }
  }, [condition]);
}
