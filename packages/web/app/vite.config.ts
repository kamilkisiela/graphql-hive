import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = new URL('.', import.meta.url).pathname;

export default defineConfig({
  root: __dirname,
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
  },
});
