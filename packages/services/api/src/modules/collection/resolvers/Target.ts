import { CollectionProvider } from '../providers/collection.provider';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<
  TargetResolvers,
  'documentCollection' | 'documentCollectionOperation' | 'documentCollections'
> = {
  documentCollections: (target, args, { injector }) =>
    injector.get(CollectionProvider).getCollections(target.id, args.first, args.after),
  documentCollectionOperation: (_, args, { injector }) =>
    injector.get(CollectionProvider).getOperation(args.id),
  documentCollection: (_, args, { injector }) =>
    injector.get(CollectionProvider).getCollection(args.id),
};
