import { useMemo } from 'react';
import { parse, print } from 'graphql/index';

export function usePrettify(sdl: string | null): string | null {
  return useMemo(() => {
    if (sdl === null) {
      return null;
    }

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

export function prettifySDL(sdl: string | null): string | null {
  if (sdl === null) {
    return null;
  }

  try {
    return print(parse(sdl));
  } catch {
    return sdl;
  }
}
