import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setErrorSource } from '@hive/service-common';
import type { Session } from '../../auth/lib/authz';
import type { GraphStore } from '../../graph/providers/graph-store';
import type { IdTranslator } from '../../shared/providers/id-translator';
import type { Logger } from '../../shared/providers/logger';
import {
  registryOperationOutcomeCount,
  registryOperationUnexpectedErrorCount,
} from '../../shared/providers/registry-operation-metrics';
import type { TargetManager } from '../../target/providers/target-manager';
import type { AppDeployments } from './app-deployments';
import { AppDeploymentsManager } from './app-deployments-manager';

// The manager's import chain reaches the ClickHouse HTTP client, whose module-level setup cannot load under vitest.
vi.mock('../../operations/providers/clickhouse-client', () => ({ ClickHouse: class {} }));

const selector = {
  organizationId: 'org-id',
  projectId: 'project-id',
  targetId: 'target-id',
};

const uploadInput = {
  reference: null,
  appDeployment: { name: 'my-app', version: '1.0.0' },
  documents: [{ hash: 'hash-0', body: '{ hello }' }],
};

function createManager(uploadError: Error) {
  const logger = {
    child: () => logger,
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const session = { raise: vi.fn(), assertPerformAction: vi.fn(async () => {}) };
  const targetManager = { getTargetById: vi.fn(async () => ({ id: selector.targetId })) };
  const appDeployments = {
    addDocumentsToAppDeployment: vi.fn(async () => {
      throw uploadError;
    }),
  };
  const idTranslator = { resolveTargetReference: vi.fn(async () => selector) };
  const graphs = { getDefaultGraphForTargetId: vi.fn(async () => ({ id: 'graph-id' })) };

  return new AppDeploymentsManager(
    logger as unknown as Logger,
    session as unknown as Session,
    targetManager as unknown as TargetManager,
    appDeployments as unknown as AppDeployments,
    idTranslator as unknown as IdTranslator,
    graphs as unknown as GraphStore,
  );
}

async function outcomeSamples() {
  const { values } = await registryOperationOutcomeCount.get();
  return values
    .filter(sample => sample.labels.operation === 'persisted_document_upload')
    .map(sample => ({ conclusion: sample.labels.conclusion, value: sample.value }));
}

async function unexpectedErrorSamples() {
  const { values } = await registryOperationUnexpectedErrorCount.get();
  return values
    .filter(sample => sample.labels.operation === 'persisted_document_upload')
    .map(sample => ({ source: sample.labels.source, value: sample.value }));
}

describe('AppDeploymentsManager.addDocumentsToAppDeployment outcome metrics', () => {
  beforeEach(() => {
    registryOperationOutcomeCount.reset();
    registryOperationUnexpectedErrorCount.reset();
  });

  it('counts an upload aborted by the client as aborted, not as a failure', async () => {
    const controller = new AbortController();
    const manager = createManager(
      setErrorSource(new Error('Request aborted by the client.'), 'client'),
    );
    controller.abort();

    await expect(
      manager.addDocumentsToAppDeployment(uploadInput, controller.signal),
    ).rejects.toThrow('Request aborted by the client.');

    await expect(outcomeSamples()).resolves.toEqual([{ conclusion: 'aborted', value: 1 }]);
    await expect(unexpectedErrorSamples()).resolves.toEqual([]);
  });

  it('counts a server-side timeout as a failure', async () => {
    const controller = new AbortController();
    const manager = createManager(
      setErrorSource(
        new Error('Timeout, worker did not respond within time.'),
        'persisted-documents-worker',
      ),
    );

    await expect(
      manager.addDocumentsToAppDeployment(uploadInput, controller.signal),
    ).rejects.toThrow('Timeout, worker did not respond within time.');

    await expect(outcomeSamples()).resolves.toEqual([{ conclusion: 'failure', value: 1 }]);
    await expect(unexpectedErrorSamples()).resolves.toEqual([
      { source: 'persisted-documents-worker', value: 1 },
    ]);
  });
});
