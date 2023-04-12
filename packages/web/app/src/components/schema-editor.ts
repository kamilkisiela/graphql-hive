import dynamic from 'next/dynamic';
import { loader, DiffEditor as MonacoDiffEditor } from '@monaco-editor/react';
import { dependencies } from '../../package.json' assert { type: 'json' };

loader.config({
  paths: {
    vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${dependencies['monaco-editor']}/min/vs`,
  },
});

export {
  MonacoDiffEditor
}

export const SchemaEditor = dynamic({
  async loader() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await import('regenerator-runtime/runtime');
    const { SchemaEditor } = await import('@theguild/editor');
    return SchemaEditor;
  },
  ssr: false,
});

export type { SchemaEditorProps } from '@theguild/editor';
