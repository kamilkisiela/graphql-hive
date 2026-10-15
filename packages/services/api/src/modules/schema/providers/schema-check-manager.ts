import type {
  FailedSchemaCheckMapper,
  SuccessfulSchemaCheckMapper,
} from '../module.graphql.mappers';
import { Injectable, Scope } from 'graphql-modules';
import type * as GraphQLSchema from '../../../__generated__/types';
import { formatNumber } from '../lib/number-formatting';
import { BreakingSchemaChangeUsageHelper } from './breaking-schema-changes-helper';
import { SchemaManager } from './schema-manager';
import { SchemaVersionStore } from './schema-version-store';

type SchemaCheck = FailedSchemaCheckMapper | SuccessfulSchemaCheckMapper;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaCheckManager {
  constructor(
    private schemaManager: SchemaManager,
    private schemaVersions: SchemaVersionStore,
    private breakingSchemaChangeUsageHelper: BreakingSchemaChangeUsageHelper,
  ) {}

  // Usage reads names and totals from the check's metadata.
  private withUsageMetadata(schemaCheck: SchemaCheck) {
    const metadata = schemaCheck.conditionalBreakingChangeMetadata;
    if (metadata) {
      for (const change of schemaCheck.breakingSchemaChanges ?? []) {
        this.breakingSchemaChangeUsageHelper.registerMetadataForBreakingSchemaChange(
          change,
          metadata,
        );
      }
    }
    return schemaCheck.breakingSchemaChanges;
  }

  getHasSchemaCompositionErrors(schemaCheck: SchemaCheck) {
    return schemaCheck.schemaCompositionErrors !== null;
  }

  getHasUnapprovedBreakingChanges(schemaCheck: SchemaCheck) {
    return schemaCheck.hasUnapprovedBreakingChanges;
  }

  getHasSchemaChanges(schemaCheck: SchemaCheck) {
    return schemaCheck.hasSchemaChanges;
  }

  getSafeSchemaChanges(schemaCheck: SchemaCheck) {
    if (!schemaCheck.safeSchemaChanges?.length) {
      return null;
    }

    return schemaCheck.safeSchemaChanges;
  }

  getAllSchemaChanges(schemaCheck: SchemaCheck) {
    if (!schemaCheck.safeSchemaChanges?.length && !schemaCheck.breakingSchemaChanges?.length) {
      return null;
    }

    return [
      ...(this.withUsageMetadata(schemaCheck) ?? []),
      ...(schemaCheck.safeSchemaChanges ?? []),
    ];
  }

  getBreakingSchemaChanges(schemaCheck: SchemaCheck) {
    if (!schemaCheck.breakingSchemaChanges?.length) {
      return null;
    }

    return this.withUsageMetadata(schemaCheck);
  }

  getSchemaVersion(schemaCheck: SchemaCheck) {
    if (schemaCheck.schemaVersionId === null) {
      return null;
    }
    return this.schemaManager.getSchemaVersionBySelector({
      organizationId: schemaCheck.selector.organizationId,
      projectId: schemaCheck.selector.projectId,
      targetId: schemaCheck.targetId,
      versionId: schemaCheck.schemaVersionId,
    });
  }

  async getPreviousSchemaSDL(schemaCheck: SchemaCheck) {
    if (schemaCheck.baselineSchemaSDL !== null) {
      return schemaCheck.baselineSchemaSDL;
    }

    if (schemaCheck.serviceName === null || schemaCheck.schemaVersionId === null) {
      return null;
    }

    const service = await this.schemaVersions.getSchemaForSchemaVersionIdAndName(
      schemaCheck.schemaVersionId,
      schemaCheck.serviceName,
    );

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
        excludedAppDeploymentNames:
          schemaCheck.conditionalBreakingChangeMetadata.settings.excludedAppDeploymentNames,
        breakingChangeFormula:
          schemaCheck.conditionalBreakingChangeMetadata.settings.breakingChangeFormula,
        requestCount: schemaCheck.conditionalBreakingChangeMetadata.settings.requestCount,
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

  async getGraphQLSchemaCheckBaseline(
    schemaCheck: SchemaCheck,
  ): Promise<GraphQLSchema.SchemaCheckBaseline | null> {
    const schemaVersion = await this.getSchemaVersion(schemaCheck);

    if (schemaCheck.baselineSchemaSDL) {
      return {
        __typename: 'SchemaCheckBaseline',
        meta: {
          commit: schemaCheck.baselineSchemaHash,
        },
        sdl: schemaCheck.baselineSchemaSDL,
        publicSdl: schemaCheck.baselinePublicSDL,
        supergraphSdl: schemaCheck.baselineSupergraphSDL,
        compositionErrors: schemaCheck.baselineCompositionErrors,
      };
    }

    const service =
      schemaCheck.serviceName && schemaVersion
        ? await this.schemaVersions.getSchemaForSchemaVersionIdAndName(
            schemaVersion.id,
            schemaCheck.serviceName,
          )
        : null;

    return {
      __typename: 'SchemaCheckBaseline',
      meta: {
        commit: service?.commit,
      },
      sdl: service?.sdl ?? null,
      publicSdl: schemaVersion?.compositeSchemaSDL ?? null,
      supergraphSdl: schemaVersion?.supergraphSDL ?? null,
      compositionErrors: schemaVersion?.schemaCompositionErrors ?? null,
    };
  }
}
