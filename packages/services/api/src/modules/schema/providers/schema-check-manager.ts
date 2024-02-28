import { Injectable, Scope } from 'graphql-modules';
import { FailedSchemaCheckMapper, SuccessfulSchemaCheckMapper } from '../../../shared/mappers';
import { Storage } from '../../shared/providers/storage';
import { formatNumber } from '../lib/number-formatting';
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

  getConditionalBreakingChangeMetadata(schemaCheck: SchemaCheck) {
    if (!schemaCheck.conditionalBreakingChangeMetadata) {
      return null;
    }

    return {
      period: {
        from: schemaCheck.conditionalBreakingChangeMetadata.period.from.toISOString(),
        to: schemaCheck.conditionalBreakingChangeMetadata.period.to.toISOString(),
      },
      settings: {
        percentage: schemaCheck.conditionalBreakingChangeMetadata.settings.percentage,
        retentionInDays: schemaCheck.conditionalBreakingChangeMetadata.settings.retentionInDays,
        excludedClientNames:
          schemaCheck.conditionalBreakingChangeMetadata.settings.excludedClientNames,
        targets: schemaCheck.conditionalBreakingChangeMetadata.settings.targets,
      },
      usage: {
        totalRequestCount: schemaCheck.conditionalBreakingChangeMetadata.usage.totalRequestCount,
        totalRequestCountFormatted: formatNumber(
          schemaCheck.conditionalBreakingChangeMetadata.usage.totalRequestCount,
        ),
      },
    };
  }
}
