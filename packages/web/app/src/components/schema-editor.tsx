import React from 'react';

export const SchemaEditor = React.lazy(() =>
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import('regenerator-runtime/runtime')
    .then(() => import('@theguild/editor'))
    .then(({ SchemaEditor }) => ({ default: SchemaEditor }))
);

export type { SchemaEditorProps } from '@theguild/editor';
