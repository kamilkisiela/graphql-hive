import { resolve } from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import monacoEditor from 'vite-plugin-monaco-editor';
import tsconfigPaths from 'vite-tsconfig-paths';
import viteFastify from '@fastify/vite/plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';

const __dirname = new URL('.', import.meta.url).pathname;

// Add react-scan in local development mode
const reactScanPlugin: Plugin = {
  name: 'react-scan',
  transformIndexHtml(html, ctx) {
    if (ctx.server?.config.command === 'serve') {
      return html.replace(
        '<head>',
        '<head><script src="https://unpkg.com/react-scan@0.4.3/dist/auto.global.js"></script>',
      );
    }

    return html;
  },
};

export default {
  root: __dirname,
  plugins: [
    tsconfigPaths(),
    viteFastify({ spa: true }),
    react(),
    // Both styling systems run side by side during the Tailwind → Vanilla Extract migration.
    tailwindcss(),
    vanillaExtractPlugin(),
    reactScanPlugin,
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: { name: process.env.RELEASE, dist: 'webapp' },
    }),
    // @ts-expect-error temp
    monacoEditor.default({
      languageWorkers: ['json', 'typescript', 'editorWorkerService'],
      customWorkers: [
        {
          label: 'graphql',
          entry: 'monaco-graphql/dist/graphql.worker',
        },
      ],
    }),
  ],
  // Keep the default iife worker format: the inline preflight worker breaks as an ES module worker
  // (e2e laboratory-preflight). The diffs worker's only dynamic import is the wasm engine it never
  // uses, so leaving it external keeps that worker a single chunk without inlining it.
  worker: { rollupOptions: { external: ['shiki/wasm'] } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        ['preflight-worker-embed']: resolve(__dirname, 'preflight-worker-embed.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.api', 'monaco-graphql/esm/monaco.contribution'],
  },
  environments: {
    client: {
      build: {
        sourcemap: 'hidden',
      },
    },
  },
} satisfies UserConfig;
