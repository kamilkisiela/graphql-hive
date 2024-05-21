import { parseArgs } from 'node:util';
import { defineConfig } from 'tsup';
import {
  commonWatchList,
  monorepoWatchList,
  targetFromNodeVersion,
  watchEntryPlugin,
} from './utils';

const entryPoints = parseArgs({
  allowPositionals: true,
  strict: false,
}).positionals;

export default defineConfig({
  entryPoints: entryPoints.length ? entryPoints : ['src/index.ts'],
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  format: 'esm',
  watch: process.env.WATCH === '0' ? false : [...commonWatchList(), ...monorepoWatchList()],
  target: targetFromNodeVersion(),
  plugins: [watchEntryPlugin()],
});
