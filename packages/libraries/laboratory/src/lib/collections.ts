import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { LaboratoryOperation } from './operations';
import type { LaboratoryTabsActions, LaboratoryTabsState } from './tabs';

export interface LaboratoryCollectionOperation extends LaboratoryOperation {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface LaboratoryCollection {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  operations: LaboratoryCollectionOperation[];
}

export interface LaboratoryCollectionsActions {
  addCollection: (
    collection: Omit<LaboratoryCollection, 'id' | 'createdAt' | 'operations'> & {
      operations?: Omit<LaboratoryCollectionOperation, 'createdAt'>[];
    },
  ) => LaboratoryCollection;
  addOperationToCollection: (
    collectionId: string,
    operation: Omit<LaboratoryCollectionOperation, 'createdAt'>,
  ) => void;
  deleteCollection: (collectionId: string) => void;
  deleteOperationFromCollection: (collectionId: string, operationId: string) => void;
  updateCollection: (
    collectionId: string,
    collection: Omit<LaboratoryCollection, 'id' | 'createdAt' | 'operations'>,
  ) => void;
  updateOperationInCollection: (
    collectionId: string,
    operationId: string,
    operation: Omit<LaboratoryCollectionOperation, 'id' | 'createdAt'>,
  ) => void;
}

export interface LaboratoryCollectionsState {
  collections: LaboratoryCollection[];
}

/** A host may answer a create with the id it stored, and the lab adopts it. */
export type LaboratoryPersisted = void | { id: string } | Promise<void | { id: string }>;

export interface LaboratoryCollectionsCallbacks {
  onCollectionCreate?: (collection: LaboratoryCollection) => LaboratoryPersisted;
  onCollectionUpdate?: (collection: LaboratoryCollection) => void;
  onCollectionDelete?: (collection: LaboratoryCollection) => void;
  onCollectionOperationCreate?: (
    collection: LaboratoryCollection,
    operation: LaboratoryCollectionOperation,
  ) => LaboratoryPersisted;
  onCollectionOperationUpdate?: (
    collection: LaboratoryCollection,
    operation: LaboratoryCollectionOperation,
  ) => void;
  onCollectionOperationDelete?: (
    collection: LaboratoryCollection,
    operation: LaboratoryCollectionOperation,
  ) => void;
}

const whenPersisted = (result: LaboratoryPersisted, adopt: (id: string) => void) => {
  void Promise.resolve(result).then(persisted => {
    if (persisted?.id) {
      adopt(persisted.id);
    }
  });
};

export const useCollections = (
  props: {
    defaultCollections?: LaboratoryCollection[];
    onCollectionsChange?: (collections: LaboratoryCollection[]) => void;
    /** A saved operation took its persisted id; working copies and tabs follow it. */
    onOperationIdChange?: (previousId: string, id: string) => void;
    tabsApi?: LaboratoryTabsState & LaboratoryTabsActions;
  } & LaboratoryCollectionsCallbacks,
): LaboratoryCollectionsState & LaboratoryCollectionsActions => {
  const [collections, setCollections] = useState<LaboratoryCollection[]>(
    props.defaultCollections ?? [],
  );

  // Persisted ids arrive after the fact, so adoption reads the last committed value.
  const collectionsRef = useRef(collections);

  const commit = useCallback(
    (next: LaboratoryCollection[]) => {
      collectionsRef.current = next;
      setCollections(next);
      props.onCollectionsChange?.(next);
    },
    [props],
  );

  const adoptCollectionId = useCallback(
    (previousId: string, id: string) => {
      commit(collectionsRef.current.map(c => (c.id === previousId ? { ...c, id } : c)));
    },
    [commit],
  );

  const adoptOperationId = useCallback(
    (collectionId: string, previousId: string, id: string) => {
      commit(
        collectionsRef.current.map(c =>
          c.id === collectionId
            ? { ...c, operations: c.operations.map(o => (o.id === previousId ? { ...o, id } : o)) }
            : c,
        ),
      );
      props.onOperationIdChange?.(previousId, id);
    },
    [commit, props],
  );

  const addCollection = useCallback(
    (
      collection: Omit<LaboratoryCollection, 'id' | 'createdAt' | 'operations'> & {
        operations?: Omit<LaboratoryCollectionOperation, 'createdAt'>[];
      },
    ) => {
      const newCollection: LaboratoryCollection = {
        ...collection,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        operations:
          collection.operations?.map(operation => ({
            ...operation,
            createdAt: new Date().toISOString(),
          })) ?? [],
      };
      commit([...collections, newCollection]);

      void Promise.resolve(props.onCollectionCreate?.(newCollection)).then(persisted => {
        const collectionId = persisted?.id ?? newCollection.id;

        if (persisted?.id) {
          adoptCollectionId(newCollection.id, persisted.id);
        }

        const persistedCollection = { ...newCollection, id: collectionId };

        for (const operation of newCollection.operations) {
          whenPersisted(props.onCollectionOperationCreate?.(persistedCollection, operation), id =>
            adoptOperationId(collectionId, operation.id, id),
          );
        }
      });

      return newCollection;
    },
    [collections, props, commit, adoptCollectionId, adoptOperationId],
  );

  const addOperation = useCallback(
    (collectionId: string, operation: Omit<LaboratoryCollectionOperation, 'createdAt'>) => {
      const newOperation: LaboratoryCollectionOperation = {
        ...operation,
        createdAt: new Date().toISOString(),
      };

      const newCollections = collections.map(collection =>
        collection.id === collectionId
          ? {
              ...collection,
              operations: [...collection.operations, newOperation],
            }
          : collection,
      );

      commit(newCollections);

      const updatedCollection = newCollections.find(collection => collection.id === collectionId);

      if (updatedCollection) {
        props.onCollectionUpdate?.(updatedCollection);
        whenPersisted(props.onCollectionOperationCreate?.(updatedCollection, newOperation), id =>
          adoptOperationId(collectionId, newOperation.id, id),
        );
      }
    },
    [collections, props, commit, adoptOperationId],
  );

  const deleteCollection = useCallback(
    (collectionId: string) => {
      const collectionToDelete = collections.find(collection => collection.id === collectionId);
      const newCollections = collections.filter(collection => collection.id !== collectionId);
      commit(newCollections);
      if (collectionToDelete) {
        props.onCollectionDelete?.(collectionToDelete);
      }
    },
    [collections, props, commit],
  );

  const deleteOperation = useCallback(
    (collectionId: string, operationId: string) => {
      let operationToDelete: LaboratoryCollectionOperation | undefined;
      const newCollections = collections.map(collection =>
        collection.id === collectionId
          ? {
              ...collection,
              operations: collection.operations.filter(operation => {
                if (operation.id === operationId) {
                  operationToDelete = operation;
                  return false;
                }
                return true;
              }),
            }
          : collection,
      );
      commit(newCollections);
      const updatedCollection = newCollections.find(collection => collection.id === collectionId);
      if (updatedCollection) {
        props.onCollectionUpdate?.(updatedCollection);
        if (operationToDelete) {
          props.onCollectionOperationDelete?.(updatedCollection, operationToDelete);
        }
      }
    },
    [collections, props, commit],
  );

  const updateCollection = useCallback(
    (
      collectionId: string,
      collection: Omit<LaboratoryCollection, 'id' | 'createdAt' | 'operations'>,
    ) => {
      const newCollections = collections.map(c =>
        c.id === collectionId ? { ...c, ...collection } : c,
      );
      commit(newCollections);
      const updatedCollection = newCollections.find(collection => collection.id === collectionId);
      if (updatedCollection) {
        props.onCollectionUpdate?.(updatedCollection);
      }
    },
    [collections, props, commit],
  );

  const updateOperation = useCallback(
    (
      collectionId: string,
      operationId: string,
      operation: Omit<LaboratoryCollectionOperation, 'id' | 'createdAt'>,
    ) => {
      let updatedOperation: LaboratoryCollectionOperation | undefined;
      const newCollections = collections.map(c => {
        if (c.id !== collectionId) {
          return c;
        }

        return {
          ...c,
          operations: c.operations.map(o => {
            if (o.id === operationId) {
              updatedOperation = { ...o, ...operation };
              return updatedOperation;
            }

            return o;
          }),
        };
      });
      commit(newCollections);
      const updatedCollection = newCollections.find(collection => collection.id === collectionId);
      if (updatedCollection) {
        props.onCollectionUpdate?.(updatedCollection);
        if (updatedOperation) {
          props.onCollectionOperationUpdate?.(updatedCollection, updatedOperation);
        }
      }
    },
    [collections, props, commit],
  );

  return {
    collections,
    addCollection,
    addOperationToCollection: addOperation,
    deleteCollection,
    deleteOperationFromCollection: deleteOperation,
    updateCollection,
    updateOperationInCollection: updateOperation,
  };
};
