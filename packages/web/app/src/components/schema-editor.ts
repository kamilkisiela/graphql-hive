import dynamic from 'next/dynamic';

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
