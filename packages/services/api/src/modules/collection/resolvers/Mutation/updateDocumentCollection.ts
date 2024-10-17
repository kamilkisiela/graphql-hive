import { TargetAccessScope } from '../../../auth/providers/scopes';
import { CollectionProvider } from '../../providers/collection.provider';
import { validateTargetAccess } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateDocumentCollection: NonNullable<
  MutationResolvers['updateDocumentCollection']
> = async (_, { selector, input }, { injector }) => {
  const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
  const result = await injector.get(CollectionProvider).updateCollection(input);

  if (!result) {
    return {
      error: {
        __typename: 'ModifyDocumentCollectionError',
        message: 'Failed to locate a document collection',
      },
    };
  }

  return {
    ok: {
      __typename: 'ModifyDocumentCollectionOkPayload',
      collection: result,
      updatedTarget: target,
    },
  };
};
