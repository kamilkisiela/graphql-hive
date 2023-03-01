/* eslint-disable no-process-env */
// eslint-disable-next-line import/no-extraneous-dependencies
import 'reflect-metadata';
import { ProjectType } from 'testkit/gql/graphql';
import { initSeed } from 'testkit/seed';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createStorage } from '@hive/storage';
import { crypto } from '@whatwg-node/fetch';

const connectionString = `pg://${process.env.POSTGRES_USER!}:${process.env
  .POSTGRES_PASSWORD!}@localhost:5432/${process.env.POSTGRES_DB!}`;

const makeStorage = () => {
  return createStorage(connectionString, 1);
};

describe('document collection', () => {
  it('create document collection', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);

      let paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 5,
        after: null,
      });

      expect(paginatedResult.items.length).toEqual(0);
      expect(paginatedResult.pageInfo).toEqual({
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: '',
        startCursor: '',
      });

      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      expect(createdDocumentCollection).toEqual({
        createdAt: expect.any(String),
        createdByUserId: null,
        description: 'Test description',
        id: expect.any(String),
        targetId: target.id,
        title: 'Test document collection',
        updatedAt: expect.any(String),
      });

      paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 5,
        after: null,
      });

      expect(paginatedResult.items.length).toEqual(1);
      expect(paginatedResult.pageInfo).toEqual({
        endCursor: expect.any(String),
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: expect.any(String),
      });
    } finally {
      await storage.destroy();
    }
  });

  it('update document collection', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);

      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      expect(createdDocumentCollection).toEqual({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
        createdAt: expect.any(String),
        id: expect.any(String),
        updatedAt: expect.any(String),
      });

      const updatedDocumentCollection = await storage.updateDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Updated title',
        description: 'Updated description',
      });

      expect(updatedDocumentCollection).toEqual({
        ...createdDocumentCollection,
        title: 'Updated title',
        description: 'Updated description',
        updatedAt: expect.any(String),
      });

      expect(updatedDocumentCollection.updatedAt).not.toEqual(createdDocumentCollection.updatedAt);
    } finally {
      await storage.destroy();
    }
  });

  it('delete document collection (existing)', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);

      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      expect(createdDocumentCollection).toEqual({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
        createdAt: expect.any(String),
        id: expect.any(String),
        updatedAt: expect.any(String),
      });

      let paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 5,
        after: null,
      });

      expect(paginatedResult.items.length).toEqual(1);

      const result = await storage.deleteDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
      });

      expect(result).toEqual(createdDocumentCollection.id);

      paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 5,
        after: null,
      });
      expect(paginatedResult.items.length).toEqual(0);
    } finally {
      await storage.destroy();
    }
  });

  it('delete document collection (non-existing)', async () => {
    const storage = await makeStorage();
    try {
      const result = await storage.deleteDocumentCollection({
        documentCollectionId: crypto.randomUUID(),
      });

      expect(result).toEqual(null);
    } finally {
      await storage.destroy();
    }
  });

  it('pagination', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);

      const createdDocumentCollection1 = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection 1',
        description: 'Test description 1',
        createdByUserId: null,
      });

      const createdDocumentCollection2 = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection 2',
        description: 'Test description 2',
        createdByUserId: null,
      });

      const createdDocumentCollection3 = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection 3',
        description: 'Test description 3',
        createdByUserId: null,
      });

      const createdDocumentCollection4 = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection 4',
        description: 'Test description 4',
        createdByUserId: null,
      });

      let paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 2,
        cursor: null,
      });

      expect(paginatedResult.items.length).toEqual(2);
      expect(paginatedResult.pageInfo).toEqual({
        hasNextPage: true,
        hasPreviousPage: false,
        endCursor: expect.any(String),
        startCursor: expect.any(String),
      });

      expect(paginatedResult.items[0].node.id).toEqual(createdDocumentCollection4.id);
      expect(paginatedResult.items[1].node.id).toEqual(createdDocumentCollection3.id);

      paginatedResult = await storage.getPaginatedDocumentCollectionsForTarget({
        targetId: target.id,
        first: 2,
        cursor: paginatedResult.pageInfo.endCursor,
      });

      expect(paginatedResult.items.length).toEqual(2);
      expect(paginatedResult.pageInfo).toEqual({
        hasNextPage: false,
        hasPreviousPage: true,
        endCursor: expect.any(String),
        startCursor: expect.any(String),
      });

      expect(paginatedResult.items[0].node.id).toEqual(createdDocumentCollection2.id);
      expect(paginatedResult.items[1].node.id).toEqual(createdDocumentCollection1.id);
    } finally {
      await storage.destroy();
    }
  });
});

describe('document collection documents', () => {
  it('create document collection document', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);
      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      let paginatedResult = await storage.getPaginatedDocumentsForDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
        first: 5,
        cursor: null,
      });

      expect(paginatedResult.items.length).toEqual(0);

      const documentCollectionDocument = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      expect(documentCollectionDocument).toEqual({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
        createdAt: expect.any(String),
        id: expect.any(String),
        updatedAt: expect.any(String),
      });

      paginatedResult = await storage.getPaginatedDocumentsForDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
        first: 5,
        cursor: null,
      });

      expect(paginatedResult.items.length).toEqual(1);
      expect(paginatedResult.items[0].node).toEqual(documentCollectionDocument);
    } finally {
      await storage.destroy();
    }
  });
  it('update document collection document', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);
      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      const documentCollectionDocument = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      const updatedDocumentCollectionDocument = await storage.updateDocumentCollectionDocument({
        documentCollectionDocumentId: documentCollectionDocument.id,
        title: 'Updated document collection document',
        contents: '{__typename}',
        variables: '{"foo":"bar"}',
        headers: '{"foo":"gnarr"}',
        createdByUserId: null,
      });

      expect(updatedDocumentCollectionDocument).toEqual({
        id: documentCollectionDocument.id,
        documentCollectionId: createdDocumentCollection.id,
        title: 'Updated document collection document',
        contents: '{__typename}',
        variables: '{"foo":"bar"}',
        headers: '{"foo":"gnarr"}',
        createdByUserId: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(updatedDocumentCollectionDocument.updatedAt).not.toEqual(
        documentCollectionDocument.updatedAt,
      );
    } finally {
      await storage.destroy();
    }
  });
  it('delete document collection document (existing)', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);
      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      const documentCollectionDocument = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      const result = await storage.deleteDocumentCollectionDocument({
        documentCollectionDocumentId: documentCollectionDocument.id,
      });

      expect(result).toEqual(documentCollectionDocument.id);
    } finally {
      await storage.destroy();
    }
  });
  it('delete document collection document (non-existing)', async () => {
    const storage = await makeStorage();
    try {
      const result = await storage.deleteDocumentCollectionDocument({
        documentCollectionDocumentId: crypto.randomUUID(),
      });

      expect(result).toEqual(null);
    } finally {
      await storage.destroy();
    }
  });
  it('pagination', async () => {
    const storage = await makeStorage();
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { target } = await createProject(ProjectType.Single);
      const createdDocumentCollection = await storage.createDocumentCollection({
        targetId: target.id,
        title: 'Test document collection',
        description: 'Test description',
        createdByUserId: null,
      });

      const createdDocumentCollectionDocument1 = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document 1',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      const createdDocumentCollectionDocument2 = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document 2',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      const createdDocumentCollectionDocument3 = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document 3',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      const createdDocumentCollectionDocument4 = await storage.createDocumentCollectionDocument({
        documentCollectionId: createdDocumentCollection.id,
        title: 'Test document collection document 4',
        contents: '{__typename}',
        variables: '',
        headers: '',
        createdByUserId: null,
      });

      let paginatedResult = await storage.getPaginatedDocumentsForDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
        first: 2,
        cursor: null,
      });

      expect(paginatedResult.items.length).toEqual(2);
      expect(paginatedResult.pageInfo).toEqual({
        hasNextPage: true,
        hasPreviousPage: false,
        endCursor: expect.any(String),
        startCursor: expect.any(String),
      });

      expect(paginatedResult.items[0].node.id).toEqual(createdDocumentCollectionDocument4.id);
      expect(paginatedResult.items[1].node.id).toEqual(createdDocumentCollectionDocument3.id);

      paginatedResult = await storage.getPaginatedDocumentsForDocumentCollection({
        documentCollectionId: createdDocumentCollection.id,
        first: 2,
        cursor: paginatedResult.pageInfo.endCursor,
      });

      expect(paginatedResult.items.length).toEqual(2);
      expect(paginatedResult.pageInfo).toEqual({
        hasNextPage: false,
        hasPreviousPage: true,
        endCursor: expect.any(String),
        startCursor: expect.any(String),
      });

      expect(paginatedResult.items[0].node.id).toEqual(createdDocumentCollectionDocument2.id);
      expect(paginatedResult.items[1].node.id).toEqual(createdDocumentCollectionDocument1.id);
    } finally {
      await storage.destroy();
    }
  });
});
