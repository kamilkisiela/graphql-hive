import { Injectable, Scope } from 'graphql-modules';
import { FailedSchemaCheckMapper, SuccessfulSchemaCheckMapper } from '../../../shared/mappers';
import { Storage } from '../../shared/providers/storage';
import { SchemaManager } from './schema-manager';

type SchemaCheck = FailedSchemaCheckMapper | SuccessfulSchemaCheckMapper;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaCheckManager {
  constructor(
    private schemaManager: SchemaManager,
    private storage: Storage,
  ) {}

  getHasSchemaCompositionErrors(schemaCheck: SchemaCheck) {
    return schemaCheck.schemaCompositionErrors !== null;
  }

  getHasUnapprovedBreakingChanges(schemaCheck: SchemaCheck) {
    return (
      schemaCheck.breakingSchemaChanges?.some(
        change => change.approvalMetadata === null && !change.isSafeBasedOnUsage,
      ) ?? false
    );
  }

  getHasSchemaChanges(schemaCheck: SchemaCheck) {
    return !!(schemaCheck.breakingSchemaChanges?.length || schemaCheck.safeSchemaChanges?.length);
  }

  getSafeSchemaChanges(schemaCheck: SchemaCheck) {
    if (!schemaCheck.safeSchemaChanges?.length) {
      return null;
    }

    return schemaCheck.safeSchemaChanges;
  }

  getBreakingSchemaChanges(schemaCheck: SchemaCheck) {
    if (!schemaCheck.breakingSchemaChanges?.length) {
      return null;
    }

    return schemaCheck.breakingSchemaChanges;
  }

  getSchemaVersion(schemaCheck: SchemaCheck) {
    if (schemaCheck.schemaVersionId === null) {
      return null;
    }
    return this.schemaManager.getSchemaVersion({
      organization: schemaCheck.selector.organizationId,
      project: schemaCheck.selector.projectId,
      target: schemaCheck.targetId,
      version: schemaCheck.schemaVersionId,
    });
  }

  async getPreviousSchemaSDL(schemaCheck: SchemaCheck) {
    if (schemaCheck.serviceName === null || schemaCheck.schemaVersionId === null) {
      return null;
    }

    const service = await this.storage.getSchemaByNameOfVersion({
      versionId: schemaCheck.schemaVersionId,
      serviceName: schemaCheck.serviceName,
    });

    return service?.sdl ?? null;
  }
}
