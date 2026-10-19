import { hashOperationIdentity } from '@graphql-hive/core';
import type { RawReport } from '@hive/usage-common';
import { createProcessor } from '../src/processor';

function buildReport(): RawReport {
  const timestamp = Date.now();
  return {
    id: '00000000-0000-4000-8000-000000000000',
    target: 'target-1',
    organization: 'org-1',
    size: 2,
    map: {
      key1: {
        key: 'key1',
        operation: 'query op{user(id:$id){name}}',
        operationName: 'op',
        fields: ['Query.user', 'Query.user.id', 'User.name'],
      },
      key2: {
        key: 'key2',
        operation: 'query op{user(id:$id){name}}',
        operationName: 'op',
        fields: ['Query.user', 'Query.user.id', 'Query.user.id!', 'User.name', 'String'],
      },
    },
    operations: [
      {
        operationMapKey: 'key1',
        timestamp,
        execution: { ok: true, duration: 1, errorsTotal: 0 },
        metadata: {},
      },
      {
        operationMapKey: 'key2',
        timestamp,
        execution: { ok: true, duration: 1, errorsTotal: 0 },
        metadata: {},
      },
    ],
    subscriptionOperations: [],
  };
}

test('operations with the same body and name share one hash regardless of their fields', async () => {
  const processor = createProcessor({ logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn() } as any });

  const result = await processor.processReports([buildReport()]);

  const expectedHash = hashOperationIdentity({
    body: 'query op{user(id:$id){name}}',
    operationName: 'op',
  });
  const operationHashes = result.operations.map(line => line.split(',')[4]);
  const registryHashes = result.registryRecords.map(line => line.split(',')[2]);

  expect(operationHashes).toEqual([`"${expectedHash}"`, `"${expectedHash}"`]);
  expect(registryHashes).toEqual([`"${expectedHash}"`, `"${expectedHash}"`]);
  expect(result.registryRecords[0]).toContain("'Query.user.id'");
  expect(result.registryRecords[0]).not.toContain("'Query.user.id!'");
  expect(result.registryRecords[1]).toContain("'Query.user.id!'");
});
