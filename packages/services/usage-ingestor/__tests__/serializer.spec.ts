import {
  stringifyOperation,
  stringifyRegistryRecord,
  formatDate,
  operationsOrder,
  registryOrder,
} from '../src/serializer';

const timestamp = {
  asNumber: 1643892203027,
  asString: '2022-02-03 12:43:23', // date as string in UTC timezone
};

const expiresAt = {
  asNumber: 1643892206037,
  asString: '2022-02-03 12:43:26', // date as string in UTC timezone
};

function renderInOrder<
  T extends {
    [key: string]: any;
  },
  K extends keyof T
>(values: T, order: readonly K[]) {
  return order.map(key => values[key]).join(',');
}

test('stringify operation in correct format and order', () => {
  const serialized = [
    {
      target: 'my-target',
      timestamp: timestamp.asNumber,
      expiresAt: expiresAt.asNumber,
      operationHash: 'my-hash',
      fields: ['Query', 'Query.foo'],
      execution: {
        ok: true,
        errorsTotal: 0,
        duration: 230,
      },
      document: `{ foo }`,
      operationType: 'query' as any,
      metadata: {
        client: {
          name: 'clientName',
          version: 'clientVersion',
        },
      },
    },
    {
      target: 'my-target',
      timestamp: timestamp.asNumber,
      expiresAt: expiresAt.asNumber,
      operationHash: 'my-hash-1',
      fields: ['Query', 'Query.foo'],
      execution: {
        ok: false,
        errorsTotal: 1,
        duration: 250,
      },
      document: `{ foo }`,
      operationType: 'query' as any,
      // missing metadata, on purpose
    },
  ]
    .map(stringifyOperation)
    .join('\n');

  expect(serialized).toBe(
    [
      renderInOrder(
        {
          target: `"my-target"`,
          timestamp: timestamp.asString,
          expires_at: expiresAt.asString,
          hash: `"my-hash"`,
          ok: 1,
          errors: 0,
          duration: 230,
          client_name: `"clientName"`,
          client_version: `"clientVersion"`,
        },
        operationsOrder
      ),
      renderInOrder(
        {
          target: `"my-target"`,
          timestamp: timestamp.asString,
          expires_at: expiresAt.asString,
          hash: `"my-hash-1"`,
          ok: 0,
          errors: 1,
          duration: 250,
          client_name: `""`,
          client_version: `""`,
        },
        operationsOrder
      ),
    ].join('\n')
  );
});

test('stringify registry records in correct format and order', () => {
  const serialized = [
    {
      size: 1,
      operation_kind: 'query',
      target: 'my-target',
      timestamp: timestamp.asNumber,
      expires_at: expiresAt.asNumber,
      name: 'my-name',
      hash: 'my-hash',
      body: `{ foo }`,
      coordinates: ['Query', 'Query.foo'],
    },
    {
      size: 2,
      target: 'my-target',
      timestamp: timestamp.asNumber,
      expires_at: expiresAt.asNumber,
      // missing name, on purpose
      hash: 'my-hash-1',
      body: `{ foo }`,
      operation_kind: 'query',
      coordinates: ['Query', 'Query.foo'],
    },
  ]
    .map(stringifyRegistryRecord)
    .join('\n');
  expect(serialized).toBe(
    [
      renderInOrder(
        {
          target: `"my-target"`,
          hash: `"my-hash"`,
          name: `"my-name"`,
          body: `"{ foo }"`,
          operation_kind: `"query"`,
          coordinates: `"['Query','Query.foo']"`,
          total: 1,
          timestamp: timestamp.asString,
          expires_at: expiresAt.asString,
        },
        registryOrder
      ),
      renderInOrder(
        {
          target: `"my-target"`,
          hash: `"my-hash-1"`,
          name: `""`,
          body: `"{ foo }"`,
          operation_kind: `"query"`,
          coordinates: `"['Query','Query.foo']"`,
          total: 2,
          timestamp: timestamp.asString,
          expires_at: expiresAt.asString,
        },
        registryOrder
      ),
    ].join('\n')
  );
});

test('formatDate should return formatted date in UTC timezone', () => {
  expect(formatDate(timestamp.asNumber)).toEqual(timestamp.asString);
});
