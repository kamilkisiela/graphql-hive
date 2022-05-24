import { TypedDocumentNode as DocumentNode } from 'urql';

export function fixDuplicatedFragments<T, V>(doc: DocumentNode<T, V>): DocumentNode<T, V> {
  const newDoc = {
    ...doc,
    definitions: doc.definitions.filter((def, i, all) => {
      if (def.kind === 'FragmentDefinition') {
        const at = all.findIndex(d => d.kind === 'FragmentDefinition' && d.name.value === def.name.value);

        return at === i;
      }

      return true;
    }),
  };

  return newDoc;
}
