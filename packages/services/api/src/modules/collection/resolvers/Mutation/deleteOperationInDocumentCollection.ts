import { TargetAccessScope } from '../../../auth/providers/scopes';
import { CollectionProvider } from '../../providers/collection.provider';
import { validateTargetAccess } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOperationInDocumentCollection: NonNullable<
  MutationResolvers['deleteOperationInDocumentCollection']
> = async (_, { selector, id }, { injector }) => {
  const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
  const operation = await injector.get(CollectionProvider).getOperation(id);

  if (!operation) {
    return {
      error: {
        __typename: 'ModifyDocumentCollectionError',
        message: 'Failed to locate a operation',
      },
    };
  }

  const collection = await injector
    .get(CollectionProvider)
    .getCollection(operation.documentCollectionId);
  await injector.get(CollectionProvider).deleteOperation(id);

  return {
    ok: {
      __typename: 'DeleteDocumentCollectionOperationOkPayload',
      deletedId: id,
      updatedTarget: target,
      updatedCollection: collection!,
    },
  };
};
