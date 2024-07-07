import * as zod from 'zod';
import { fromZodError } from 'zod-validation-error';
import { TargetAccessScope } from '../../../auth/providers/scopes';
import { CollectionProvider } from '../../providers/collection.provider';
import { OperationValidationInputModel, validateTargetAccess } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOperationInDocumentCollection: NonNullable<
  MutationResolvers['updateOperationInDocumentCollection']
> = async (_, { selector, input }, { injector }) => {
  try {
    OperationValidationInputModel.parse(input);
    const target = await validateTargetAccess(injector, selector, TargetAccessScope.REGISTRY_WRITE);
    const result = await injector.get(CollectionProvider).updateOperation(input);

    if (!result) {
      return {
        error: {
          __typename: 'ModifyDocumentCollectionError',
          message: 'Failed to locate a document collection',
        },
      };
    }

    const collection = await injector
      .get(CollectionProvider)
      .getCollection(result.documentCollectionId);

    return {
      ok: {
        __typename: 'ModifyDocumentCollectionOperationOkPayload',
        operation: result,
        updatedTarget: target,
        collection: collection!,
      },
    };
  } catch (e) {
    if (e instanceof zod.ZodError) {
      return {
        error: {
          __typename: 'ModifyDocumentCollectionError',
          message: fromZodError(e).message,
        },
      };
    }

    throw e;
  }
};
