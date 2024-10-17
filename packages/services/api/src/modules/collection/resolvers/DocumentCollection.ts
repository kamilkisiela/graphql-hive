import { CollectionProvider } from '../providers/collection.provider';
import type { DocumentCollectionResolvers } from './../../../__generated__/types.next';

export const DocumentCollection: DocumentCollectionResolvers = {
  id: root => root.id,
  name: root => root.title,
  description: root => root.description,
  operations: (root, args, { injector }) =>
    injector.get(CollectionProvider).getOperations(root.id, args.first, args.after),
  createdBy: async (_parent, _arg, _ctx) => {
    console.log({ _parent });
    return (_parent as any).createdBy;
  },
};
