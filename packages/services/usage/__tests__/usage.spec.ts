import { splitReport } from '../src/usage';
import type { RawReport } from '@hive/usage-common';

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
  const report: RawReport = {
    id: 'test-id',
    size: 5,
    target: 'test-target',
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
  };

  const reports = splitReport(report, 3);
  expect(reports).toHaveLength(3);

  expect(Object.keys(reports[0].map)).toEqual(['op1']);
  expect(reports[0].size).toEqual(2);
  expect(reports[0].operations[0].operationMapKey).toEqual('op1');
  expect(reports[0].operations[1].operationMapKey).toEqual('op1');

  expect(Object.keys(reports[1].map)).toEqual(['op2']);
  expect(reports[1].size).toEqual(1);
  expect(reports[1].operations[0].operationMapKey).toEqual('op2');

  expect(Object.keys(reports[2].map)).toEqual(['op3']);
  expect(reports[2].size).toEqual(2);
  expect(reports[2].operations[0].operationMapKey).toEqual('op3');
  expect(reports[2].operations[1].operationMapKey).toEqual('op3');
});
