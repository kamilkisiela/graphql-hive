import 'reflect-metadata';
import type { FailedSchemaCheckMapper } from '../module.graphql.mappers';
import { describe, expect, test } from 'vitest';
import { SchemaCheckManager } from './schema-check-manager';

/** A composite check whose baseline was stored with it, loaded without its SDLs. */
const storedBaselineCheck = {
  __typename: 'FailedSchemaCheck',
  id: 'check-1',
  targetId: 'target-1',
  selector: { organizationId: 'org-1', projectId: 'project-1' },
  schemaVersionId: 'version-1',
  serviceName: 'reviews',
  hasBaselineSchemaSDL: true,
  baselineSchemaSDL: null,
  baselinePublicSDL: null,
  baselineSupergraphSDL: null,
  baselineSchemaHash: 'baseline-commit',
  baselineCompositionErrors: [{ message: 'baseline did not compose', source: 'composition' }],
} as unknown as FailedSchemaCheckMapper;

function manager() {
  const schemaManager = {
    getSchemaVersionBySelector: async () => ({
      id: 'version-1',
      compositeSchemaSDL: 'type Query { fromVersion: ID }',
      supergraphSDL: null,
      schemaCompositionErrors: null,
    }),
  };
  const schemaVersions = {
    getSchemaForSchemaVersionIdAndName: async () => ({
      commit: 'version-commit',
      sdl: 'type Query { fromVersion: ID }',
    }),
  };
  return new SchemaCheckManager(schemaManager as any, schemaVersions as any, {} as any);
}

describe('SchemaCheckManager.getGraphQLSchemaCheckBaseline', () => {
  test('a stored baseline is reported from the check even when its SDLs were not loaded', async () => {
    await expect(manager().getGraphQLSchemaCheckBaseline(storedBaselineCheck)).resolves.toEqual({
      __typename: 'SchemaCheckBaseline',
      meta: { commit: 'baseline-commit' },
      sdl: null,
      publicSdl: null,
      supergraphSdl: null,
      compositionErrors: [{ message: 'baseline did not compose', source: 'composition' }],
    });
  });
});
