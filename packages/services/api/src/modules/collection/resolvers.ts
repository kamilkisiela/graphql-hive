// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck TODO: fix Property 'node' does not exist on type ...
import { CollectionModule } from './__generated__/types';
import { CollectionProvider } from './providers/collection.provider';

export const resolvers: CollectionModule.Resolvers = {
  Collection: {
    id: root => root.node.id,
    name: root => root.node.title,
    description: root => root.node.description,
    items(root, args, { injector }) {
      return injector.get(CollectionProvider).getOperations(root.node.id);
    },
  },
  CollectionItemsConnection: {
    edges: root => root.items,
  },
  Operation: {
    name: root => root.title,
    query: root => root.contents,
    async collection(root, args, { injector }) {
      const node = await injector.get(CollectionProvider).getCollection(root.documentCollectionId);
      return { node };
    },
  },
  Query: {
    async collections(_, args, { injector }) {
      const collections = await injector.get(CollectionProvider).getCollections(args.targetId);
      return {
        nodes: collections.items,
        total: collections.items.length,
      };
    },
    operation(_, args, { injector }) {
      return injector.get(CollectionProvider).getOperation(args.id);
    },
    async collection(_, args, { injector }) {
      const node = await injector.get(CollectionProvider).getCollection(args.id);
      return { node };
    },
  },
  Mutation: {
    async createCollection(_, { input }, { injector }) {
      const node = await injector.get(CollectionProvider).createCollection(input);
      return { node };
    },
    async updateCollection(_, { input }, { injector }) {
      const node = await injector.get(CollectionProvider).updateCollection(input);
      return { node };
    },
    async deleteCollection(_, args, { injector }) {
      await injector.get(CollectionProvider).deleteCollection(args.id);

      return {
        node: {
          id: args.id,
        },
      };
    },
    createOperation(_, { input }, { injector }) {
      return injector.get(CollectionProvider).createOperation(input);
    },
    updateOperation(_, { input }, { injector }) {
      return injector.get(CollectionProvider).updateOperation(input);
    },
    async deleteOperation(_, args, { injector }) {
      await injector.get(CollectionProvider).deleteOperation(args.id);

      return {
        id: args.id,
      };
    },
  },
};
