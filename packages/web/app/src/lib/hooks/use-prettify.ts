import { useMemo } from 'react';
import { parse, print } from 'graphql/index';

export function usePrettify(sdl: string): string {
  return useMemo(() => {
    if (!sdl) {
      return '';
    }

    try {
      return print(parse(sdl));
    } catch {
      return sdl;
    }
  }, [sdl]);
}
