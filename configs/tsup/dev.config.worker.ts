import { defineConfig } from 'tsup';
import {
  commonWatchList,
  monorepoWatchList,
  targetFromNodeVersion,
  watchEntryPlugin,
} from './utils';

export default defineConfig({
  splitting: false,
  sourcemap: true,
  clean: true,
  format: 'esm',
  watch: [...commonWatchList(), ...monorepoWatchList()],
  target: targetFromNodeVersion(),
  plugins: [watchEntryPlugin()],
});
