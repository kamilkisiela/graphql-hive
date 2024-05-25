import type {
  DocumentCollection,
  DocumentCollectionOperation,
  PaginatedDocumentCollectionOperations,
  PaginatedDocumentCollections,
} from '../../shared/entities';

export type DocumentCollectionMapper = DocumentCollection;
export type DocumentCollectionOperationMapper = DocumentCollectionOperation;
export type DocumentCollectionConnectionMapper = PaginatedDocumentCollections;
export type DocumentCollectionOperationsConnectionMapper = PaginatedDocumentCollectionOperations;
