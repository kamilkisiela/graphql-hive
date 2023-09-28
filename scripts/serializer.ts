import rawSnapshotSerializer from 'jest-snapshot-serializer-raw/always';
import { expect } from 'vitest';
import { normalizeCliOutput } from './serializers/cli-output';

expect.addSnapshotSerializer(rawSnapshotSerializer);

expect.addSnapshotSerializer({
  test: value => typeof value === 'string' && (value.includes('✔') || value.includes('ℹ')),
  print: value => normalizeCliOutput(value as string),
});
