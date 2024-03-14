import {
  formatDate,
  joinIntoSingleMessage,
  stringifyQueryOrMutationOperation,
  stringifyRegistryRecord,
} from '../src/serializer';

const timestamp = {
  asNumber: 1_643_892_203_027,
  asString: '2022-02-03 12:43:23', // date as string in UTC timezone
};

const expiresAt = {
  asNumber: 1_643_892_206_037,
  asString: '2022-02-03 12:43:26', // date as string in UTC timezone
};

test('stringify operation in correct format and order', () => {
  const serialized = joinIntoSingleMessage(
    [
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
    ].map(stringifyQueryOrMutationOperation),
  );
  expect(serialized).toBe(
    [
      [
        /* target */ `"my-target"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ expiresAt.asString,
        /* hash */ `"my-hash"`,
        /* ok */ 1,
        /* errors */ 0,
        /* duration */ 230,
        /* client_name */ `"clientName"`,
        /* client_version */ `"clientVersion"`,
      ].join(','),
      [
        /* target */ `"my-target"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ expiresAt.asString,
        /* hash */ `"my-hash-1"`,
        /* ok */ 0,
        /* errors */ 1,
        /* duration */ 250,
        /* client_name */ `\\N`,
        /* client_version */ `\\N`,
      ].join(','),
    ].join('\n'),
  );
});

test('stringify registry records in correct format and order', () => {
  const serialized = joinIntoSingleMessage(
    [
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
    ].map(stringifyRegistryRecord),
  );
  expect(serialized).toBe(
    [
      [
        /* total */ 1,
        /* target */ `"my-target"`,
        /* hash */ `"my-hash"`,
        /* name */ `"my-name"`,
        /* body */ `"{ foo }"`,
        /* operation_kind */ `"query"`,
        /* coordinates */ `"['Query','Query.foo']"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ expiresAt.asString,
      ].join(','),
      [
        /* total */ 2,
        /* target */ `"my-target"`,
        /* hash */ `"my-hash-1"`,
        /* name */ `\\N`,
        /* body */ `"{ foo }"`,
        /* operation_kind */ `"query"`,
        /* coordinates */ `"['Query','Query.foo']"`,
        /* timestamp */ timestamp.asString,
        /* expires_at */ expiresAt.asString,
      ].join(','),
    ].join('\n'),
  );
});

test('formatDate should return formatted date in UTC timezone', () => {
  expect(formatDate(timestamp.asNumber)).toEqual(timestamp.asString);
});
