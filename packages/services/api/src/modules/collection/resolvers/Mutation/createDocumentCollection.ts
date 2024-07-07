import { TargetAccessScope } from '../../../auth/providers/scopes';
import { CollectionProvider } from '../../providers/collection.provider';
import { validateTargetAccess } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createDocumentCollection: NonNullable<
  MutationResolvers['createDocumentCollection']
> = async (_, { selector, input }, { injector }) => {
  const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
  const result = await injector.get(CollectionProvider).createCollection(target.id, input);

  return {
    ok: {
      __typename: 'ModifyDocumentCollectionOkPayload',
      collection: result,
      updatedTarget: target,
    },
  };
};
