/* eslint-disable import/no-extraneous-dependencies */
import { Kind, visit } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';

export const addTypenameDocumentTransform: Types.DocumentTransformObject = {
  transform({ documents }) {
    return documents.map(document => ({
      ...document,
      document: document.document
        ? visit(document.document, {
            SelectionSet(node) {
              if (
                !node.selections.find(
                  selection => selection.kind === 'Field' && selection.name.value === '__typename',
                )
              ) {
                return {
                  ...node,
                  selections: [
                    {
                      kind: Kind.FIELD,
                      name: {
                        kind: Kind.NAME,
                        value: '__typename',
                      },
                    },
                    ...node.selections,
                  ],
                };
              }
            },
          })
        : undefined,
    }));
  },
};
