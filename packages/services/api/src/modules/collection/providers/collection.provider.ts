import { Injectable, Scope } from 'graphql-modules';
import { AuthManager } from '../../auth/providers/auth-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import type { CollectionModule } from './../__generated__/types';

@Injectable({
  global: true,
  scope: Scope.Operation,
})
export class CollectionProvider {
  private logger: Logger;

  constructor(
    logger: Logger,
    private storage: Storage,
    private authManager: AuthManager,
  ) {
    this.logger = logger.child({ source: 'CollectionProvider' });
  }

  getCollections(targetId: string, first: number, cursor: string | null) {
    return this.storage.getPaginatedDocumentCollectionsForTarget({
      targetId,
      first,
      cursor,
    });
  }

  getCollection(id: string) {
    return this.storage.getDocumentCollection({ id });
  }

  getOperations(documentCollectionId: string, first: number, cursor: string | null) {
    return this.storage.getPaginatedDocumentsForDocumentCollection({
      documentCollectionId,
      first,
      cursor,
    });
  }

  getOperation(id: string) {
    return this.storage.getDocumentCollectionDocument({ id });
  }

  async createCollection(
    targetId: string,
    {
      name,
      description,
    }: Pick<CollectionModule.CreateDocumentCollectionInput, 'description' | 'name'>,
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

  async createOperation(input: CollectionModule.CreateDocumentCollectionOperationInput) {
    const currentUser = await this.authManager.getCurrentUser();

    return this.storage.createDocumentCollectionDocument({
      documentCollectionId: input.collectionId,
      title: input.name,
      contents: input.query,
      variables: input.variables ?? null,
      headers: input.headers ?? null,
      createdByUserId: currentUser.id,
    });
  }

  updateOperation(input: CollectionModule.UpdateDocumentCollectionOperationInput) {
    return this.storage.updateDocumentCollectionDocument({
      documentCollectionDocumentId: input.operationId,
      title: input.name ?? null,
      contents: input.query ?? null,
      variables: input.variables ?? null,
      headers: input.headers ?? null,
    });
  }

  updateCollection(input: CollectionModule.UpdateDocumentCollectionInput) {
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
