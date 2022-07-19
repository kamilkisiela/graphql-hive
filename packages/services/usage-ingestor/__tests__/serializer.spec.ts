import { stringifyOperation, stringifyRegistryRecord, joinIntoSingleMessage, formatDate } from '../src/serializer';

const timestamp = {
  asNumber: 1643892203027,
  asString: '2022-02-03 12:43:23', // date as string in UTC timezone
};

test('stringify operation in correct format and order', () => {
  const serialized = joinIntoSingleMessage(
    [
      {
        target: 'my-target',
        timestamp: timestamp.asNumber,
        expiresAt: timestamp.asNumber,
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
        expiresAt: timestamp.asNumber,
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
    ].map(stringifyOperation)
  );
  expect(serialized).toBe(
    [
      [
        /* target */ `"my-target"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ timestamp.asString,
        /* hash */ `"my-hash"`,
        /* ok */ 1,
        /* errors */ 0,
        /* duration */ 230,
        /* schema */ `"['Query','Query.foo']"`,
        /* client_name */ `"clientName"`,
        /* client_version */ `"clientVersion"`,
      ].join(','),
      [
        /* target */ `"my-target"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ timestamp.asString,
        /* hash */ `"my-hash-1"`,
        /* ok */ 0,
        /* errors */ 1,
        /* duration */ 250,
        /* schema */ `"['Query','Query.foo']"`,
        /* client_name */ `\\N`,
        /* client_version */ `\\N`,
      ].join(','),
    ].join('\n')
  );
});

test('stringify registry records in correct format and order', () => {
  const serialized = joinIntoSingleMessage(
    [
      {
        target: 'my-target',
        inserted_at: timestamp.asNumber,
        name: 'my-name',
        hash: 'my-hash',
        body: `{ foo }`,
        operation: 'query',
      },
      {
        target: 'my-target',
        inserted_at: timestamp.asNumber,
        // missing name, on purpose
        hash: 'my-hash-1',
        body: `{ foo }`,
        operation: 'query',
      },
    ].map(stringifyRegistryRecord)
  );
  expect(serialized).toBe(
    [
      [
        /* target */ `"my-target"`,
        /* hash */ `"my-hash"`,
        /* name */ `"my-name"`,
        /* body */ `"{ foo }"`,
        /* operation */ `"query"`,
        /* inserted_at */ timestamp.asString,
      ].join(','),
      [
        /* target */ `"my-target"`,
        /* hash */ `"my-hash-1"`,
        /* name */ `\\N`,
        /* body */ `"{ foo }"`,
        /* operation */ `"query"`,
        /* inserted_at */ timestamp.asString,
      ].join(','),
    ].join('\n')
  );
});

test('formatDate should return formatted date in UTC timezone', () => {
  expect(formatDate(timestamp.asNumber)).toEqual(timestamp.asString);
});
