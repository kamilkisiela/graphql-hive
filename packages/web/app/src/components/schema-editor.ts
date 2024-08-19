import { lazy } from 'react';
import {
  loader,
  DiffEditor as MonacoDiffEditor,
  Editor as MonacoEditor,
} from '@monaco-editor/react';
import pkg from '../../package.json' with { type: 'json' };

loader.config({
  paths: {
    vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${pkg.devDependencies['monaco-editor']}/min/vs`,
  },
});

export { MonacoDiffEditor };
export { MonacoEditor };

export const SchemaEditor = lazy(async () => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await import('regenerator-runtime/runtime');
  const { SchemaEditor } = await import('@theguild/editor');
  return { default: SchemaEditor };
});

export type { SchemaEditorProps } from '@theguild/editor';
