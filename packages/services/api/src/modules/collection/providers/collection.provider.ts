import { Injectable, Scope } from 'graphql-modules';
import {
  CreateDocumentCollectionInput,
  CreateDocumentCollectionOperationInput,
  UpdateDocumentCollectionInput,
  UpdateDocumentCollectionOperationInput,
} from '@/graphql';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';

@Injectable({
  global: true,
  scope: Scope.Operation,
})
export class CollectionProvider {
  private logger: Logger;

  constructor(logger: Logger, private storage: Storage, private authManager: AuthManager) {
    this.logger = logger.child({ source: 'CollectionProvider' });
  }

  getCollections(targetId: string) {
    return this.storage.getPaginatedDocumentCollectionsForTarget({
      targetId,
      first: 100,
      cursor: null,
    });
  }

  getCollection(id: string) {
    return this.storage.getDocumentCollection({ id });
  }

  getOperations(documentCollectionId: string) {
    return this.storage.getPaginatedDocumentsForDocumentCollection({
      documentCollectionId,
      first: 100,
      cursor: null,
    });
  }

  getOperation(id: string) {
    return this.storage.getDocumentCollectionDocument({ id });
  }

  async createCollection(
    targetId: string,
    { name, description }: Pick<CreateDocumentCollectionInput, 'description' | 'name'>,
  ) {
    const currentUser = await this.authManager.getCurrentUser();

    return this.storage.createDocumentCollection({
      createdByUserId: currentUser.id,
      title: name,
      description: description || '',
      targetId,
    });
  }

  deleteCollection(id: string) {
    return this.storage.deleteDocumentCollection({ documentCollectionId: id });
  }

  async createOperation(input: CreateDocumentCollectionOperationInput) {
    const currentUser = await this.authManager.getCurrentUser();
    return this.storage.createDocumentCollectionDocument({
      documentCollectionId: input.collectionId,
      title: input.name,
      contents: input.query,
      variables: input.variables,
      headers: input.headers,
      createdByUserId: currentUser.id,
    });
  }

  updateOperation(input: UpdateDocumentCollectionOperationInput) {
    return this.storage.updateDocumentCollectionDocument({
      documentCollectionDocumentId: input.operationId,
      title: input.name,
      contents: input.query,
      variables: input.variables,
      headers: input.headers,
    });
  }

  updateCollection(input: UpdateDocumentCollectionInput) {
    return this.storage.updateDocumentCollection({
      documentCollectionId: input.collectionId,
      description: input.description || null,
      title: input.name,
    });
  }

  deleteOperation(id: string) {
    return this.storage.deleteDocumentCollectionDocument({ documentCollectionDocumentId: id });
  }
}
