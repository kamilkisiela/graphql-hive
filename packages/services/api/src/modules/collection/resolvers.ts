import { Injector } from 'graphql-modules';
import * as zod from 'zod';
import { fromZodError } from 'zod-validation-error';
import { TargetSelectorInput } from '../../__generated__/types';
import { AuditLogManager } from '../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { TargetAccessScope } from '../auth/providers/scopes';
import { IdTranslator } from '../shared/providers/id-translator';
import { Storage } from '../shared/providers/storage';
import { CollectionModule } from './__generated__/types';
import { CollectionProvider } from './providers/collection.provider';

const MAX_INPUT_LENGTH = 10_000;

// The following validates the length and the validity of the JSON object incoming as string.
const inputObjectSchema = zod
  .string()
  .max(MAX_INPUT_LENGTH)
  .optional()
  .nullable()
  .refine(v => {
    if (!v) {
      return true;
    }

    try {
      JSON.parse(v);
      return true;
    } catch {
      return false;
    }
  });

const OperationValidationInputModel = zod
  .object({
    collectionId: zod.string(),
    name: zod.string().min(1).max(100),
    query: zod.string().min(1).max(MAX_INPUT_LENGTH),
    variables: inputObjectSchema,
    headers: inputObjectSchema,
  })
  .partial()
  .passthrough();

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
    name: op => op.title,
    query: op => op.contents,
    async collection(op, args, { injector }) {
      const collection = await injector
        .get(CollectionProvider)
        .getCollection(op.documentCollectionId);

      // This should not happen, but we do want to flag this as an unexpected error.
      if (!collection) {
        throw new Error('Collection not found');
      }

      return collection;
    },
  },
  Target: {
    documentCollections: (target, args, { injector }) =>
      injector.get(CollectionProvider).getCollections(target.id, args.first, args.after),
    documentCollectionOperation: (_, args, { injector }) =>
      injector.get(CollectionProvider).getOperation(args.id),
    documentCollection: (_, args, { injector }) =>
      injector.get(CollectionProvider).getCollection(args.id),
  },
  Mutation: {
    async createDocumentCollection(_, { selector, input }, { injector }) {
      const target = await validateTargetAccess(
        injector,
        selector,
        TargetAccessScope.REGISTRY_WRITE,
      );
      const result = await injector.get(CollectionProvider).createCollection(target.id, input);

      const currentUser = await injector.get(AuthManager).getCurrentUser();

      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'COLLECTION_CREATED',
          collectionCreatedAuditLogSchema: {
            collectionId: result.id,
            collectionName: input.name,
            targetId: target.id,
          },
        },
        {
          organizationId: target.orgId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return {
        ok: {
          __typename: 'ModifyDocumentCollectionOkPayload',
          collection: result,
          updatedTarget: target,
        },
      };
    },
    async updateDocumentCollection(_, { selector, input }, { injector }) {
      const target = await validateTargetAccess(
        injector,
        selector,
        TargetAccessScope.REGISTRY_WRITE,
      );
      const result = await injector.get(CollectionProvider).updateCollection(input);

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'COLLECTION_UPDATED',
          collectionUpdatedAuditLogSchema: {
            collectionId: input.collectionId,
            collectionName: input.name,
            updatedFields: JSON.stringify({
              description: input.description,
            }),
          },
        },
        {
          organizationId: target.orgId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

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
    },
    async deleteDocumentCollection(_, { selector, id }, { injector }) {
      const target = await validateTargetAccess(
        injector,
        selector,
        TargetAccessScope.REGISTRY_WRITE,
      );
      await injector.get(CollectionProvider).deleteCollection(id);

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'COLLECTION_DELETED',
          collectionDeletedAuditLogSchema: {
            collectionId: id,
            collectionName: target.name,
          },
        },
        {
          organizationId: target.orgId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return {
        ok: {
          __typename: 'DeleteDocumentCollectionOkPayload',
          deletedId: id,
          updatedTarget: target,
        },
      };
    },
    async createOperationInDocumentCollection(_, { selector, input }, { injector }) {
      try {
        OperationValidationInputModel.parse(input);
        const target = await validateTargetAccess(
          injector,
          selector,
          TargetAccessScope.REGISTRY_WRITE,
        );
        const result = await injector.get(CollectionProvider).createOperation(input);
        const collection = await injector
          .get(CollectionProvider)
          .getCollection(result.documentCollectionId);

        if (!result || !collection) {
          return {
            error: {
              __typename: 'ModifyDocumentCollectionError',
              message: 'Failed to locate a document collection',
            },
          };
        }

        const currentUser = await injector.get(AuthManager).getCurrentUser();
        injector.get(AuditLogManager).createLogAuditEvent(
          {
            eventType: 'OPERATION_IN_DOCUMENT_COLLECTION_CREATED',
            operationInDocumentCollectionCreatedAuditLogSchema: {
              collectionId: result.documentCollectionId,
              operationId: result.id,
              collectionName: collection.title,
              operationQuery: input.query,
              targetId: target.id,
            },
          },
          {
            organizationId: target.orgId,
            userEmail: currentUser.email,
            userId: currentUser.id,
            user: currentUser,
          },
        );

        return {
          ok: {
            __typename: 'ModifyDocumentCollectionOperationOkPayload',
            operation: result,
            updatedTarget: target,
            collection,
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
    },
    async updateOperationInDocumentCollection(_, { selector, input }, { injector }) {
      try {
        OperationValidationInputModel.parse(input);
        const target = await validateTargetAccess(
          injector,
          selector,
          TargetAccessScope.REGISTRY_WRITE,
        );
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

        const currentUser = await injector.get(AuthManager).getCurrentUser();
        injector.get(AuditLogManager).createLogAuditEvent(
          {
            eventType: 'OPERATION_IN_DOCUMENT_COLLECTION_UPDATED',
            operationInDocumentCollectionUpdatedAuditLogSchema: {
              collectionId: result.documentCollectionId,
              operationId: result.id,
              collectionName: collection ? collection.title : '',
              updatedFields: JSON.stringify({
                name: input.name,
                query: input.query,
                variables: input.variables,
                headers: input.headers,
              }),
            },
          },
          {
            organizationId: target.orgId,
            userEmail: currentUser.email,
            userId: currentUser.id,
            user: currentUser,
          },
        );

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
    },
    async deleteOperationInDocumentCollection(_, { selector, id }, { injector }) {
      const target = await validateTargetAccess(
        injector,
        selector,
        TargetAccessScope.REGISTRY_WRITE,
      );
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

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'OPERATION_IN_DOCUMENT_COLLECTION_DELETED',
          operationInDocumentCollectionDeletedAuditLogSchema: {
            collectionId: operation.documentCollectionId,
            operationId: id,
            collectionName: collection ? collection.title : '',
          },
        },
        {
          organizationId: target.orgId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return {
        ok: {
          __typename: 'DeleteDocumentCollectionOperationOkPayload',
          deletedId: id,
          updatedTarget: target,
          updatedCollection: collection!,
        },
      };
    },
  },
};
