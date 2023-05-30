import { createConnection } from '../../shared/schema';
import { CollectionModule } from './__generated__/types';
import { CollectionProvider } from './providers/collection.provider';

export const resolvers: CollectionModule.Resolvers = {
  DocumentCollection: {
    id: root => root.id,
    name: root => root.title,
    description: root => root.description,
    async operations(root, args, { injector }) {
      const result = await injector.get(CollectionProvider).getOperations(root.id);

      return result.items.map(v => v.node);
    },
  },
  DocumentCollectionConnection: createConnection(),
  DocumentCollectionOperationsConnection: createConnection(),
  DocumentCollectionOperation: {
    name: root => root.title,
    query: root => root.contents,
    async collection(root, args, { injector }) {
      const node = await injector.get(CollectionProvider).getCollection(root.documentCollectionId);

      return node;
    },
  },
  Target: {
    async documentCollections(target, args, { injector }) {
      const collections = await injector.get(CollectionProvider).getCollections(target.id);

      return collections.items.map(v => v.node);
    },
    documentCollectionOperation(_, args, { injector }) {
      return injector.get(CollectionProvider).getOperation(args.id);
    },
    async documentCollection(_, args, { injector }) {
      const node = await injector.get(CollectionProvider).getCollection(args.id);
      return node;
    },
  },
  Mutation: {
    async createDocumentCollection(_, { input }, { injector }) {
      const node = await injector.get(CollectionProvider).createCollection(input);
      return node;
    },
    async updateDocumentCollection(_, { input }, { injector }) {
      const node = await injector.get(CollectionProvider).updateCollection(input);
      return node;
    },
    async deleteDocumentCollection(_, args, { injector }) {
      await injector.get(CollectionProvider).deleteCollection(args.id);

      return true;
    },
    createOperationInDocumentCollection(_, { input }, { injector }) {
      return injector.get(CollectionProvider).createOperation(input);
    },
    updateOperationInDocumentCollection(_, { input }, { injector }) {
      return injector.get(CollectionProvider).updateOperation(input);
    },
    async deleteOperationInDocumentCollection(_, args, { injector }) {
      await injector.get(CollectionProvider).deleteOperation(args.id);

      return true;
    },
  },
};
