// twin.d.ts
import { css as cssImport, styled as styledImport } from 'twin.macro';

declare module 'twin.macro' {
  // The styled and css imports
  const styled: typeof styledImport;
  const css: typeof cssImport;
}
