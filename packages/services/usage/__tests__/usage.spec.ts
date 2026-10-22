import type { RawReport } from '@hive/usage-common';
import { isSplittable, splitReport } from '../src/usage';

test('should split report based on operation map length', () => {
  const now = Date.now();
  const op1 = {
    operationMapKey: 'op1',
    timestamp: now,
    execution: {
      ok: true,
      errorsTotal: 0,
      duration: 100,
    },
    metadata: {
      client: {
        name: 'test-client',
        version: 'test-version',
      },
    },
  };
  const op2 = {
    operationMapKey: 'op2',
    timestamp: now,
    execution: {
      ok: true,
      errorsTotal: 0,
      duration: 100,
    },
    metadata: {
      client: {
        name: 'test-client',
        version: 'test-version',
      },
    },
  };
  const op3 = {
    operationMapKey: 'op3',
    timestamp: now,
    execution: {
      ok: true,
      errorsTotal: 0,
      duration: 100,
    },
    metadata: {
      client: {
        name: 'test-client',
        version: 'test-version',
      },
    },
  };
  const subscriptionOp1 = {
    operationMapKey: 'op1',
    timestamp: now,
  };
  const subscriptionOp3 = {
    operationMapKey: 'op3',
    timestamp: now,
  };
  const error1 = {
    operationMapKey: 'op1',
    timestamp: now,
    errors: [{ code: 'FIELD_ERROR', coordinate: 'Query.field1' }],
  };
  const error2 = {
    operationMapKey: 'op2',
    timestamp: now,
    errors: [{ code: 'FIELD_ERROR', coordinate: 'Query.field2' }, { coordinate: 'Query.field2b' }],
  };
  const appDeploymentUsageTimestamps = {
    'my-app/1.0.0': now,
  };
  const report: RawReport = {
    id: 'test-id',
    size: 5,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: {
        key: 'op1',
        operation: 'test-operation-1',
        fields: ['test-field-1'],
      },
      op2: {
        key: 'op2',
        operation: 'test-operation-2',
        fields: ['test-field-2'],
      },
      op3: {
        key: 'op3',
        operation: 'test-operation-3',
        fields: ['test-field-3'],
      },
    },
    operations: [op1, op1, op2, op3, op3],
    subscriptionOperations: [subscriptionOp1, subscriptionOp3],
    errors: [error1, error2],
    appDeploymentUsageTimestamps,
  };

  const reports = splitReport(report, 3);
  expect(reports).toHaveLength(3);

  expect(Object.keys(reports[0].map)).toEqual(['op1']);
  expect(reports[0].organization).toEqual('test-organization');
  expect(reports[0].target).toEqual('test-target');
  expect(reports[0].operations[0].operationMapKey).toEqual('op1');
  expect(reports[0].operations[1].operationMapKey).toEqual('op1');
  expect(reports[0].subscriptionOperations).toEqual([subscriptionOp1]);
  expect(reports[0].errors).toEqual([error1]);
  // operations + subscriptionOperations routed to this chunk
  expect(reports[0].size).toEqual(3);

  expect(Object.keys(reports[1].map)).toEqual(['op2']);
  expect(reports[1].organization).toEqual('test-organization');
  expect(reports[1].target).toEqual('test-target');
  expect(reports[1].operations[0].operationMapKey).toEqual('op2');
  expect(reports[1].subscriptionOperations).toBeUndefined();
  expect(reports[1].errors).toEqual([error2]);
  expect(reports[1].size).toEqual(1);

  expect(Object.keys(reports[2].map)).toEqual(['op3']);
  expect(reports[2].organization).toEqual('test-organization');
  expect(reports[2].target).toEqual('test-target');
  expect(reports[2].operations[0].operationMapKey).toEqual('op3');
  expect(reports[2].operations[1].operationMapKey).toEqual('op3');
  expect(reports[2].subscriptionOperations).toEqual([subscriptionOp3]);
  expect(reports[2].errors).toBeUndefined();
  expect(reports[2].size).toEqual(3);

  // appDeploymentUsageTimestamps isn't keyed by operationMapKey, so it can't be
  // partitioned - it's attached to exactly one (the last, guaranteed non-empty)
  // chunk instead of duplicated into every chunk.
  expect(reports[0].appDeploymentUsageTimestamps).toBeUndefined();
  expect(reports[1].appDeploymentUsageTimestamps).toBeUndefined();
  expect(reports[2].appDeploymentUsageTimestamps).toEqual(appDeploymentUsageTimestamps);
});

test('should skip empty chunks when numOfChunks exceeds the number of map keys', () => {
  const now = Date.now();
  const report: RawReport = {
    id: 'test-id',
    size: 2,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: { key: 'op1', operation: 'test-operation-1', fields: [] },
      op2: { key: 'op2', operation: 'test-operation-2', fields: [] },
    },
    operations: [
      {
        operationMapKey: 'op1',
        timestamp: now,
        execution: { ok: true, errorsTotal: 0, duration: 1 },
      },
      {
        operationMapKey: 'op2',
        timestamp: now,
        execution: { ok: true, errorsTotal: 0, duration: 1 },
      },
    ],
  };

  const reports = splitReport(report, 10);

  expect(reports).toHaveLength(2);
  for (const chunk of reports) {
    expect(Object.keys(chunk.map).length).toBeGreaterThan(0);
  }
});

test('should preserve all errors when splitting a report with one hot operation and many errors', () => {
  const now = Date.now();
  const report: RawReport = {
    id: 'test-id',
    size: 1,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: {
        key: 'op1',
        operation: 'test-operation-1',
        fields: ['test-field-1'],
      },
    },
    operations: [
      {
        operationMapKey: 'op1',
        timestamp: now,
        execution: { ok: false, errorsTotal: 300, duration: 100 },
      },
    ],
    errors: Array.from({ length: 300 }, (_, i) => ({
      operationMapKey: 'op1',
      timestamp: now,
      errors: [{ code: 'FIELD_ERROR', coordinate: `Query.field${i}` }],
    })),
  };

  // A single map key can't actually be divided further (see isSplittable), but the
  // split must still preserve every error rather than silently dropping them.
  const reports = splitReport(report, 4);
  const totalErrors = reports.reduce((sum, r) => sum + (r.errors?.length ?? 0), 0);
  expect(totalErrors).toEqual(300);
});

test('isSplittable is true only when a report has more than one operation map key', () => {
  const baseReport: Omit<RawReport, 'map'> = {
    id: 'test-id',
    size: 0,
    target: 'test-target',
    organization: 'test-organization',
    operations: [],
  };

  expect(isSplittable({ ...baseReport, map: {} })).toBe(false);
  expect(
    isSplittable({
      ...baseReport,
      map: { op1: { key: 'op1', operation: 'a', fields: [] } },
    }),
  ).toBe(false);
  expect(
    isSplittable({
      ...baseReport,
      map: {
        op1: { key: 'op1', operation: 'a', fields: [] },
        op2: { key: 'op2', operation: 'b', fields: [] },
      },
    }),
  ).toBe(true);
});
