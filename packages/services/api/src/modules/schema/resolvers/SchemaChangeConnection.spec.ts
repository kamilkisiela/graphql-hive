import type { SchemaChangeConnectionMapper, SchemaChangeMapper } from '../module.graphql.mappers';
import { describe, expect, test } from 'vitest';
import { pageSchemaChanges } from '../lib/schema-change-pages';
import { SchemaChangeConnection } from './SchemaChangeConnection';

const changes = Array.from({ length: 120 }, () => ({}) as SchemaChangeMapper);
const cursor = (index: number) => Buffer.from(String(index)).toString('base64');

function pageInfo(connection: SchemaChangeConnectionMapper) {
  const resolve = SchemaChangeConnection.pageInfo as (
    connection: SchemaChangeConnectionMapper,
  ) => unknown;
  return resolve(connection);
}

describe('SchemaChangeConnection.pageInfo', () => {
  test('an empty cursor marks the end of the list in each direction', () => {
    expect(pageInfo(pageSchemaChanges(changes, { first: 50, offset: 0 }))).toEqual({
      startCursor: '',
      endCursor: cursor(49),
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(pageInfo(pageSchemaChanges(changes, { first: 50, offset: 50 }))).toEqual({
      startCursor: cursor(50),
      endCursor: cursor(99),
      hasPreviousPage: true,
      hasNextPage: true,
    });
    expect(pageInfo(pageSchemaChanges(changes, { first: 50, offset: 100 }))).toEqual({
      startCursor: cursor(100),
      endCursor: '',
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  test('an unpaged or empty list has no cursors', () => {
    const ends = { startCursor: '', endCursor: '', hasPreviousPage: false, hasNextPage: false };
    expect(pageInfo(changes)).toEqual(ends);
    expect(pageInfo(pageSchemaChanges([], { first: 50, offset: 0 }))).toEqual(ends);
  });
});
