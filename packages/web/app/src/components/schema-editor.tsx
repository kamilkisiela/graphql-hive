import dynamic from 'next/dynamic';

export const SchemaEditor = dynamic(
  () =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    import('regenerator-runtime/runtime')
      .then(() => import('@theguild/editor'))
      .then(({ SchemaEditor }) => ({ default: SchemaEditor })),
  {
    ssr: false,
  }
);

export type { SchemaEditorProps } from '@theguild/editor';
