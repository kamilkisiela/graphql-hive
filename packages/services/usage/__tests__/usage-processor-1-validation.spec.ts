import { validateOperation, validateOperationMapRecord } from '../src/usage-processor-1';

test('correct operation should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        timestamp: Date.now(),
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {},
      },
      {
        a: {
          operation: 'query foo { foo }',
          operationName: 'foo',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with missing timestamp should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
      },
      {
        a: {
          operation: 'query foo { foo }',
          operationName: 'foo',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with missing operationName should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {},
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with missing metadata should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {},
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with empty metadata.client should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {
          client: {},
        },
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with empty metadata.client.version should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {
          client: {
            name: 'asd',
          },
        },
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with empty metadata.client.name should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 0,
        },
        metadata: {
          client: {
            version: 'asd',
          },
        },
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with empty list in metadata.client.errors should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 1,
          errors: [],
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test('operation with empty metadata.client.errors.path should be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 1,
          errors: [
            {
              message: 'asd',
            },
          ],
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toMatchObject({ valid: true });
});

test.skip('operation with empty metadata.client.errors.message should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 12_405,
          errorsTotal: 1,
          errors: [{} as any],
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty in execution should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {},
      } as any,
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty in execution.ok should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          duration: 12_405,
          errorsTotal: 1,
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty execution.duration should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          errorsTotal: 1,
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty execution.errorsTotal should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 1245,
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with non-boolean execution.ok should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: 1,
          duration: 1245,
          errorsTotal: 0,
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with non-number execution.duration should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: '1234',
          errorsTotal: 0,
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with non-number execution.errorsTotal should NOT be valid', () => {
  expect(
    validateOperation(
      {
        operationMapKey: 'a',
        execution: {
          ok: true,
          duration: 1234,
          errorsTotal: '0',
        } as any,
      },
      {
        a: {
          operation: 'query foo { foo }',
          fields: ['Query', 'Query.foo'],
        },
      },
    ),
  ).toEqual(expect.objectContaining({ valid: false }));
});

//

test('operation with empty operation should NOT be valid', () => {
  expect(
    validateOperationMapRecord({
      fields: ['Query', 'Query.foo'],
    } as any),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty in fields should NOT be valid', () => {
  expect(
    validateOperationMapRecord({
      operation: 'query foo { foo }',
    } as any),
  ).toEqual(expect.objectContaining({ valid: false }));
});

test('operation with empty fields should NOT be valid', () => {
  expect(validateOperationMapRecord({ operation: 'query foo { foo }', fields: [] })).toEqual(
    expect.objectContaining({ valid: false }),
  );
});
