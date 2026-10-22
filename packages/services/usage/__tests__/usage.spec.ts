import type { RawReport } from '@hive/usage-common';
import { calculateReportSize, isSplittable, splitReport } from '../src/usage';

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

test('should skip empty chunks when numOfChunks exceeds the number of entries under one map key', () => {
  const now = Date.now();
  const report: RawReport = {
    id: 'test-id',
    size: 3,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: { key: 'op1', operation: 'test-operation-1', fields: [] },
    },
    operations: [
      { operationMapKey: 'op1', timestamp: now, execution: { ok: true, errorsTotal: 0, duration: 1 } },
      { operationMapKey: 'op1', timestamp: now, execution: { ok: true, errorsTotal: 0, duration: 1 } },
      { operationMapKey: 'op1', timestamp: now, execution: { ok: true, errorsTotal: 0, duration: 1 } },
    ],
  };

  const reports = splitReport(report, 10);

  expect(reports).toHaveLength(3);
  const totalOperations = reports.reduce((sum, r) => sum + r.operations.length, 0);
  expect(totalOperations).toEqual(3);
  for (const chunk of reports) {
    expect(chunk.operations.length).toBeGreaterThan(0);
    expect(chunk.map).toEqual(report.map);
  }
});

test('should divide subscriptionOperations under one map key when there are no operations', () => {
  const now = Date.now();
  const subscriptionOperations = Array.from({ length: 4 }, () => ({
    operationMapKey: 'op1',
    timestamp: now,
  }));
  const report: RawReport = {
    id: 'test-id',
    size: 4,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: { key: 'op1', operation: 'test-operation-1', fields: [] },
    },
    operations: [],
    subscriptionOperations,
  };

  const reports = splitReport(report, 2);

  expect(reports).toHaveLength(2);
  const totalSubscriptionOperations = reports.reduce(
    (sum, r) => sum + (r.subscriptionOperations?.length ?? 0),
    0,
  );
  expect(totalSubscriptionOperations).toEqual(4);
  for (const chunk of reports) {
    expect(chunk.operations).toEqual([]);
    expect(chunk.subscriptionOperations?.length).toEqual(2);
    expect(chunk.map).toEqual(report.map);
  }
});

test('should divide a hot operation (one map key, many operations) by entries, not by map key', () => {
  const baseTime = Date.now();
  const report: RawReport = {
    id: 'test-id',
    size: 8,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: {
        key: 'op1',
        operation: 'test-operation-1',
        fields: ['test-field-1'],
      },
    },
    operations: Array.from({ length: 8 }, (_, i) => ({
      operationMapKey: 'op1',
      timestamp: baseTime + i,
      execution: { ok: i % 2 === 0, errorsTotal: i % 2 === 0 ? 0 : 1, duration: 1 },
    })),
  };

  // A single map key can't be divided further, but the 8 operations under it can -
  // the split must divide them across multiple reports rather than collapsing
  // everything into one, while keeping the (duplicated) map entry available in
  // every chunk so each operation's operationMapKey still resolves.
  const reports = splitReport(report, 4);
  expect(reports).toHaveLength(4);

  const totalOperations = reports.reduce((sum, r) => sum + r.operations.length, 0);
  expect(totalOperations).toEqual(8);
  for (const chunk of reports) {
    expect(chunk.operations.length).toEqual(2);
    expect(chunk.map).toEqual(report.map);
  }
});

test('should route each error into the same chunk as the operation it came from', () => {
  const baseTime = Date.now();
  // usage-processor-2.ts tags an error with its originating operation's own
  // operationMapKey + timestamp - the only link back to it, since the two arrays
  // share no index/id. Only the odd-indexed operations produced an error here.
  const operations = Array.from({ length: 8 }, (_, i) => ({
    operationMapKey: 'op1',
    timestamp: baseTime + i,
    execution: { ok: i % 2 === 0, errorsTotal: i % 2 === 0 ? 0 : 1, duration: 1 },
  }));
  const errors = operations
    .filter((_, i) => i % 2 === 1)
    .map(op => ({
      operationMapKey: op.operationMapKey,
      timestamp: op.timestamp,
      errors: [{ code: 'FIELD_ERROR', coordinate: 'Query.field' }],
    }));

  const report: RawReport = {
    id: 'test-id',
    size: operations.length,
    target: 'test-target',
    organization: 'test-organization',
    map: {
      op1: { key: 'op1', operation: 'test-operation-1', fields: ['test-field-1'] },
    },
    operations,
    errors,
  };

  const reports = splitReport(report, 4);

  const totalErrors = reports.reduce((sum, r) => sum + (r.errors?.length ?? 0), 0);
  expect(totalErrors).toEqual(errors.length);

  // Every error must end up in the same chunk as the operation with the matching
  // timestamp - never separated from the operation it describes.
  for (const chunk of reports) {
    const operationTimestamps = new Set(chunk.operations.map(op => op.timestamp));
    for (const errorRecord of chunk.errors ?? []) {
      expect(operationTimestamps.has(errorRecord.timestamp)).toBe(true);
    }
  }
});

test('calculateReportSize counts operations, subscriptionOperations, map keys, and error entries', () => {
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
    ],
    subscriptionOperations: [{ operationMapKey: 'op2', timestamp: now }],
    errors: [
      {
        operationMapKey: 'op1',
        timestamp: now,
        errors: [{ coordinate: 'a' }, { coordinate: 'b' }],
      },
    ],
  };

  // 2 map keys + 1 operation + 1 subscriptionOperation + 2 error entries
  expect(calculateReportSize(report)).toEqual(6);
});

test('isSplittable is true when a report has more than one map key, operation, or subscriptionOperation', () => {
  const now = Date.now();
  const baseReport: Omit<RawReport, 'map'> = {
    id: 'test-id',
    size: 0,
    target: 'test-target',
    organization: 'test-organization',
    operations: [],
  };
  const singleMap = { op1: { key: 'op1', operation: 'a', fields: [] } };
  const op = {
    operationMapKey: 'op1',
    timestamp: now,
    execution: { ok: true, errorsTotal: 0, duration: 1 },
  };
  const subscriptionOp = { operationMapKey: 'op1', timestamp: now };

  // The true floor: nothing left to divide by any axis.
  expect(isSplittable({ ...baseReport, map: {} })).toBe(false);
  expect(isSplittable({ ...baseReport, map: singleMap })).toBe(false);
  expect(isSplittable({ ...baseReport, map: singleMap, operations: [op] })).toBe(false);
  expect(
    isSplittable({ ...baseReport, map: singleMap, subscriptionOperations: [subscriptionOp] }),
  ).toBe(false);

  // More than one map key is splittable by key, regardless of operations.
  expect(
    isSplittable({
      ...baseReport,
      map: {
        op1: { key: 'op1', operation: 'a', fields: [] },
        op2: { key: 'op2', operation: 'b', fields: [] },
      },
    }),
  ).toBe(true);

  // A single map key with more than one operation (or subscriptionOperation) is
  // still splittable by dividing those entries, even though the map can't shrink.
  expect(isSplittable({ ...baseReport, map: singleMap, operations: [op, op] })).toBe(true);
  expect(
    isSplittable({
      ...baseReport,
      map: singleMap,
      subscriptionOperations: [subscriptionOp, subscriptionOp],
    }),
  ).toBe(true);
});
