import { Injector } from 'graphql-modules';
import { TargetSelectorInput } from '../../__generated__/types';
import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/scopes';
import { IdTranslator } from '../shared/providers/id-translator';
import { Storage } from '../shared/providers/storage';
import { CollectionModule } from './__generated__/types';
import { CollectionProvider } from './providers/collection.provider';

async function validateTargetAccess(
  injector: Injector,
  selector: TargetSelectorInput,
  scope: TargetAccessScope = TargetAccessScope.REGISTRY_READ,
) {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(selector),
    translator.translateProjectId(selector),
    translator.translateTargetId(selector),
  ]);

  await injector.get(AuthManager).ensureTargetAccess({
    organization,
    project,
    target,
    scope,
  });

  return await injector.get(Storage).getTarget({ target, organization, project });
}

export const resolvers: CollectionModule.Resolvers = {
  DocumentCollection: {
    id: root => root.id,
    name: root => root.title,
    description: root => root.description,
    operations: (root, args, { injector }) =>
      injector.get(CollectionProvider).getOperations(root.id, args.first, args.after),
  },
  DocumentCollectionOperation: {
    name: root => root.title,
    query: root => root.contents,
    collection: (root, args, { injector }) =>
      injector.get(CollectionProvider).getCollection(root.documentCollectionId),
  },
  Target: {
    documentCollections: (target, args, { injector }) =>
      injector.get(CollectionProvider).getCollections(target.id, args.first, args.after),
    documentCollectionOperation: (_, args, { injector }) => injector.get(CollectionProvider).getOperation(args.id),
    documentCollection: (_, args, { injector }) => injector.get(CollectionProvider).getCollection(args.id),
  },
  Mutation: {
    async createDocumentCollection(_, { selector, input }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        const result = await injector.get(CollectionProvider).createCollection(target.id, input);

        return {
          ok: {
            __typename: 'ModifyDocumentCollectionOkPayload',
            collection: result,
            updatedTarget: target,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to create a document collection',
          },
        };
      }
    },
    async updateDocumentCollection(_, { selector, input }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        const result = await injector.get(CollectionProvider).updateCollection(input);

        return {
          ok: {
            __typename: 'ModifyDocumentCollectionOkPayload',
            collection: result,
            updatedTarget: target,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to update a document collection',
          },
        };
      }
    },
    async deleteDocumentCollection(_, { selector, id }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        await injector.get(CollectionProvider).deleteCollection(id);

        return {
          ok: {
            __typename: 'DeleteDocumentCollectionOkPayload',
            deletedId: id,
            updatedTarget: target,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to update a document collection',
          },
        };
      }
    },
    async createOperationInDocumentCollection(_, { selector, input }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        const result = await injector.get(CollectionProvider).createOperation(input);
        const collection = await injector
          .get(CollectionProvider)
          .getCollection(result.documentCollectionId);

        return {
          ok: {
            __typename: 'ModifyDocumentCollectionOperationOkPayload',
            operation: result,
            updatedTarget: target,
            collection,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to create operation in document collection',
          },
        };
      }
    },
    async updateOperationInDocumentCollection(_, { selector, input }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        const result = await injector.get(CollectionProvider).updateOperation(input);
        const collection = await injector
          .get(CollectionProvider)
          .getCollection(result.documentCollectionId);

        return {
          ok: {
            __typename: 'ModifyDocumentCollectionOperationOkPayload',
            operation: result,
            updatedTarget: target,
            collection,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to update operation in document collection',
          },
        };
      }
    },
    async deleteOperationInDocumentCollection(_, { selector, id }, { injector }) {
      try {
        const target = await validateTargetAccess(injector, selector, TargetAccessScope.SETTINGS);
        const operation = await injector.get(CollectionProvider).getOperation(id);
        const collection = await injector
          .get(CollectionProvider)
          .getCollection(operation.documentCollectionId);
        await injector.get(CollectionProvider).deleteOperation(id);

        return {
          ok: {
            __typename: 'DeleteDocumentCollectionOperationOkPayload',
            deletedId: id,
            updatedTarget: target,
            updatedCollection: collection,
          },
        };
      } catch (e) {
        return {
          error: {
            __typename: 'ModifyDocumentCollectionError',
            message: 'Failed to update a document collection',
          },
        };
      }
    },
  },
};
