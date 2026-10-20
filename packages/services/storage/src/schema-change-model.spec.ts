import { HiveSchemaChangeModel } from './schema-change-model';

test('a removed union member is checked against the member type', () => {
  const change = HiveSchemaChangeModel.parse({
    type: 'UNION_MEMBER_REMOVED',
    meta: { unionName: 'Media', removedUnionMemberTypeName: 'Video' },
  });

  expect(change.path).toEqual('Media');
  expect(change.breakingChangeSchemaCoordinate).toEqual('Video');
});

test('a removed type is checked against its own name', () => {
  const change = HiveSchemaChangeModel.parse({
    type: 'TYPE_REMOVED',
    meta: { removedTypeName: 'Currency' },
  });

  expect(change.breakingChangeSchemaCoordinate).toEqual('Currency');
});

test('a non-breaking change has no coordinate to check', () => {
  const change = HiveSchemaChangeModel.parse({
    type: 'UNION_MEMBER_ADDED',
    meta: { unionName: 'Media', addedUnionMemberTypeName: 'Audio' },
  });

  expect(change.breakingChangeSchemaCoordinate).toBeNull();
});
