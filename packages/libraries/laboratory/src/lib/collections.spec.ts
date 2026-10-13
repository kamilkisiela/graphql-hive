// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import {
  useCollections,
  type LaboratoryCollection,
  type LaboratoryCollectionOperation,
} from './collections';

const operation = (id: string): Omit<LaboratoryCollectionOperation, 'createdAt'> => ({
  id,
  name: id,
  description: '',
  query: 'query { a }',
  variables: '',
  headers: '',
  extensions: '',
});

describe('useCollections', () => {
  it('addCollection fires onCollectionsChange and onCollectionCreate', () => {
    const onCollectionsChange = vi.fn();
    const onCollectionCreate = vi.fn();
    const { result } = renderHook(() =>
      useCollections({ onCollectionsChange, onCollectionCreate }),
    );

    let created: LaboratoryCollection;
    act(() => {
      created = result.current.addCollection({ name: 'New' });
    });

    expect(created!.id).toBeTruthy();
    expect(onCollectionsChange).toHaveBeenCalledWith([created!]);
    expect(onCollectionCreate).toHaveBeenCalledWith(created!);
  });

  it('addOperationToCollection fires BOTH onCollectionOperationCreate and onCollectionUpdate', () => {
    const onCollectionOperationCreate = vi.fn();
    const onCollectionUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCollections({ onCollectionOperationCreate, onCollectionUpdate }),
    );

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'New' }).id;
    });
    act(() => {
      result.current.addOperationToCollection(collectionId, operation('op1'));
    });

    expect(onCollectionOperationCreate).toHaveBeenCalledTimes(1);
    expect(onCollectionOperationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: collectionId! }),
      expect.objectContaining({ id: 'op1' }),
    );
    expect(onCollectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: collectionId! }));
  });

  it('updateCollection merges the new name and fires onCollectionUpdate', () => {
    const onCollectionUpdate = vi.fn();
    const { result } = renderHook(() => useCollections({ onCollectionUpdate }));

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'Old' }).id;
    });
    act(() => {
      result.current.updateCollection(collectionId, { name: 'Renamed' });
    });

    expect(result.current.collections[0].name).toBe('Renamed');
    expect(onCollectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed' }));
  });

  it('deleteCollection fires onCollectionDelete with the removed collection', () => {
    const onCollectionDelete = vi.fn();
    const { result } = renderHook(() => useCollections({ onCollectionDelete }));

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'Doomed' }).id;
    });
    act(() => {
      result.current.deleteCollection(collectionId);
    });

    expect(result.current.collections).toHaveLength(0);
    expect(onCollectionDelete).toHaveBeenCalledWith(expect.objectContaining({ id: collectionId! }));
  });

  it('deleteOperationFromCollection fires onCollectionOperationDelete and onCollectionUpdate', () => {
    const onCollectionOperationDelete = vi.fn();
    const onCollectionUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCollections({ onCollectionOperationDelete, onCollectionUpdate }),
    );

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'C', operations: [operation('op1')] }).id;
    });
    act(() => {
      result.current.deleteOperationFromCollection(collectionId, 'op1');
    });

    expect(result.current.collections[0].operations).toHaveLength(0);
    expect(onCollectionOperationDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: collectionId! }),
      expect.objectContaining({ id: 'op1' }),
    );
    expect(onCollectionUpdate).toHaveBeenCalled();
  });

  it('updateOperationInCollection updates the operation and fires onCollectionOperationUpdate and onCollectionUpdate', () => {
    const onCollectionOperationUpdate = vi.fn();
    const onCollectionUpdate = vi.fn();
    const { result } = renderHook(() =>
      useCollections({ onCollectionOperationUpdate, onCollectionUpdate }),
    );

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'C', operations: [operation('op1')] }).id;
    });
    act(() => {
      result.current.updateOperationInCollection(collectionId, 'op1', {
        name: 'Renamed',
        description: '',
        query: 'query { b }',
        variables: '',
        headers: '',
        extensions: '',
      });
    });

    expect(result.current.collections[0].operations[0].name).toBe('Renamed');
    expect(onCollectionOperationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: collectionId! }),
      expect.objectContaining({ id: 'op1', name: 'Renamed' }),
    );
    expect(onCollectionUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: collectionId! }));
  });
});

describe('useCollections persisted ids', () => {
  const flush = () => act(async () => {});

  it('adopts the id a host returns for a new collection', async () => {
    const onCollectionsChange = vi.fn();
    const { result } = renderHook(() =>
      useCollections({
        onCollectionsChange,
        onCollectionCreate: () => Promise.resolve({ id: 'server-c1' }),
      }),
    );

    act(() => {
      result.current.addCollection({ name: 'New' });
    });
    await flush();

    expect(result.current.collections.map(c => c.id)).toEqual(['server-c1']);
    expect(onCollectionsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'server-c1' }),
    ]);
  });

  it('creates the operations a collection was created with, under the persisted id', async () => {
    const onCollectionOperationCreate = vi.fn(() => Promise.resolve({ id: 'server-op1' }));
    const onOperationIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCollections({
        onCollectionCreate: () => ({ id: 'server-c1' }),
        onCollectionOperationCreate,
        onOperationIdChange,
      }),
    );

    act(() => {
      result.current.addCollection({ name: 'New', operations: [operation('op1')] });
    });
    await flush();

    expect(onCollectionOperationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-c1' }),
      expect.objectContaining({ id: 'op1' }),
    );
    expect(result.current.collections[0].operations.map(o => o.id)).toEqual(['server-op1']);
    expect(onOperationIdChange).toHaveBeenCalledWith('op1', 'server-op1');
  });

  it('adopts the id of an operation saved into an existing collection', async () => {
    const onOperationIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCollections({
        onCollectionOperationCreate: () => Promise.resolve({ id: 'server-op1' }),
        onOperationIdChange,
      }),
    );

    let collectionId: string;
    act(() => {
      collectionId = result.current.addCollection({ name: 'New' }).id;
    });
    await flush();
    act(() => {
      result.current.addOperationToCollection(collectionId, operation('op1'));
    });
    await flush();

    expect(result.current.collections[0].operations.map(o => o.id)).toEqual(['server-op1']);
    expect(onOperationIdChange).toHaveBeenCalledWith('op1', 'server-op1');
  });

  it('keeps local ids when the host returns nothing', async () => {
    const onOperationIdChange = vi.fn();
    const { result } = renderHook(() =>
      useCollections({
        onCollectionCreate: () => undefined,
        onCollectionOperationCreate: () => undefined,
        onOperationIdChange,
      }),
    );

    let created: LaboratoryCollection;
    act(() => {
      created = result.current.addCollection({ name: 'New' });
    });
    act(() => {
      result.current.addOperationToCollection(created.id, operation('op1'));
    });
    await flush();

    expect(result.current.collections[0].id).toBe(created!.id);
    expect(result.current.collections[0].operations[0].id).toBe('op1');
    expect(onOperationIdChange).not.toHaveBeenCalled();
  });
});
