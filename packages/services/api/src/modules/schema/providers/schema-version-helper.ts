import { print } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { CriticalityLevel } from '@graphql-inspector/core';
import type { SchemaChangeType } from '@hive/storage';
import {
  containsSupergraphSpec,
  transformSupergraphToPublicSchema,
} from '@theguild/federation-composition';
import { ProjectType } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import type { SchemaVersion } from '../../../shared/mappers';
import { parseGraphQLSource } from '../../../shared/schema';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { RegistryChecks } from './registry-checks';
import { ensureCompositeSchemas, SchemaHelper } from './schema-helper';
import { SchemaManager } from './schema-manager';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
/**
 * Utilities for working with schema versions.
 * Because we only started introducing persisting changes/sdl/supergraph later on,
 * we sometimes have to compute them on the fly when someone is accessing older schema versions.
 */
export class SchemaVersionHelper {
  constructor(
    private schemaManager: SchemaManager,
    private schemaHelper: SchemaHelper,
    private projectManager: ProjectManager,
    private organizationManager: OrganizationManager,
    private registryChecks: RegistryChecks,
    private storage: Storage,
    private logger: Logger,
  ) {}

  @cache<SchemaVersion>(version => version.id)
  private async composeSchemaVersion(schemaVersion: SchemaVersion) {
    const [schemas, project, organization] = await Promise.all([
      this.schemaManager.getMaybeSchemasOfVersion({
        version: schemaVersion.id,
        organization: schemaVersion.organization,
        project: schemaVersion.project,
        target: schemaVersion.target,
      }),
      this.projectManager.getProject({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
      }),
      this.organizationManager.getOrganization({
        organization: schemaVersion.organization,
      }),
    ]);

    if (schemas.length === 0) {
      return null;
    }

    const orchestrator = this.schemaManager.matchOrchestrator(project.type);
    const validation = await orchestrator.composeAndValidate(
      schemas.map(s => this.schemaHelper.createSchemaObject(s)),
      {
        external: project.externalComposition,
        native: this.schemaManager.checkProjectNativeFederationSupport({
          project,
          organization,
        }),
        contracts: null,
      },
    );

    return validation;
  }

  async getSchemaCompositionErrors(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.schemaCompositionErrors;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.errors?.length ? composition.errors : null;
  }

  async getCompositeSchemaSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.compositeSchemaSDL
        ? this.autoFixCompositeSchemaSdl(schemaVersion.compositeSchemaSDL, schemaVersion.id)
        : null;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.sdl ?? null;
  }

  async getSupergraphSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.supergraphSDL
        ? this.autoFixCompositeSchemaSdl(schemaVersion.supergraphSDL, schemaVersion.id)
        : null;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.supergraph ?? null;
  }

  @cache<SchemaVersion>(version => version.id)
  async getCompositeSchemaAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getCompositeSchemaSdl(schemaVersion);
    if (compositeSchemaSdl === null) {
      return null;
    }

    const compositeSchemaAst = parseGraphQLSource(
      compositeSchemaSdl,
      'parse composite schema sdl in SchemaVersionHelper.getCompositeSchemaAst',
    );

    return compositeSchemaAst;
  }

  @cache<SchemaVersion>(version => version.id)
  async getSupergraphAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getSupergraphSdl(schemaVersion);
    if (compositeSchemaSdl === null) {
      return null;
    }

    const supergraphAst = parseGraphQLSource(
      compositeSchemaSdl,
      'parse supergraph sdl in SchemaVersionHelper.getSupergraphAst',
    );

    return supergraphAst;
  }

  @cache<SchemaVersion>(version => version.id)
  private async getSchemaChanges(schemaVersion: SchemaVersion) {
    if (!schemaVersion.isComposable) {
      return null;
    }

    if (schemaVersion.hasPersistedSchemaChanges) {
      const changes = await this.schemaManager.getSchemaChangesForVersion({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
        target: schemaVersion.target,
        version: schemaVersion.id,
      });

      const safeChanges: Array<SchemaChangeType> = [];
      const breakingChanges: Array<SchemaChangeType> = [];

      for (const change of changes ?? []) {
        if (change.criticality === CriticalityLevel.Breaking) {
          breakingChanges.push(change);
          continue;
        }
        safeChanges.push(change);
      }

      return {
        breaking: breakingChanges.length ? breakingChanges : null,
        safe: safeChanges.length ? safeChanges : null,
      };
    }

    const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);

    if (!previousVersion) {
      return null;
    }

    const existingSdl = await this.getCompositeSchemaSdl(previousVersion);
    const incomingSdl = await this.getCompositeSchemaSdl(schemaVersion);

    const [schemaBefore, schemasAfter] = await Promise.all([
      this.schemaManager.getMaybeSchemasOfVersion({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
        target: schemaVersion.target,
        version: schemaVersion.id,
      }),
      this.schemaManager.getMaybeSchemasOfVersion({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
        target: schemaVersion.target,
        version: previousVersion.id,
      }),
    ]);

    if (!existingSdl || !incomingSdl) {
      return null;
    }

    const project = await this.projectManager.getProject({
      organization: schemaVersion.organization,
      project: schemaVersion.project,
    });

    const diffCheck = await this.registryChecks.diff({
      approvedChanges: null,
      existingSdl,
      incomingSdl,
      includeUrlChanges: {
        schemasBefore: ensureCompositeSchemas(schemaBefore),
        schemasAfter: ensureCompositeSchemas(schemasAfter),
      },
      filterOutFederationChanges: project.type === ProjectType.FEDERATION,
      // For things that we compute on the fly we just ignore the latest usage data.
      usageDataSelector: null,
    });

    if (diffCheck.status === 'skipped') {
      return null;
    }

    return diffCheck.reason ?? diffCheck.result;
  }

  async getPreviousDiffableSchemaVersion(
    schemaVersion: SchemaVersion,
  ): Promise<SchemaVersion | null> {
    if (schemaVersion.recordVersion === '2024-01-10') {
      if (schemaVersion.diffSchemaVersionId) {
        return await this.schemaManager.getSchemaVersion({
          organization: schemaVersion.organization,
          project: schemaVersion.project,
          target: schemaVersion.target,
          version: schemaVersion.diffSchemaVersionId,
        });
      }
      return null;
    }

    return await this.schemaManager.getVersionBeforeVersionId({
      organization: schemaVersion.organization,
      project: schemaVersion.project,
      target: schemaVersion.target,
      beforeVersionId: schemaVersion.id,
      beforeVersionCreatedAt: schemaVersion.createdAt,
    });
  }

  async getBreakingSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this.getSchemaChanges(schemaVersion);
    return changes?.breaking ?? null;
  }

  async getSafeSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this.getSchemaChanges(schemaVersion);
    return changes?.safe ?? null;
  }

  async getHasSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this.getSchemaChanges(schemaVersion);
    return !!changes?.breaking?.length || !!changes?.safe?.length;
  }

  async getIsFirstComposableVersion(schemaVersion: SchemaVersion) {
    if (schemaVersion.recordVersion === '2024-01-10') {
      return schemaVersion.diffSchemaVersionId === null;
    }

    if (schemaVersion.hasPersistedSchemaChanges && schemaVersion.isComposable) {
      const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);
      if (previousVersion === null) {
        return true;
      }
    }

    const composableVersion =
      await this.schemaManager.getFirstComposableSchemaVersionBeforeVersionId({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
        target: schemaVersion.target,
        beforeVersionId: schemaVersion.id,
        beforeVersionCreatedAt: schemaVersion.createdAt,
      });

    return !!composableVersion;
  }

  async getServiceSdlForPreviousVersionService(schemaVersion: SchemaVersion, serviceName: string) {
    const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);
    if (!previousVersion) {
      return null;
    }

    const schemaLog = await this.storage.getServiceSchemaOfVersion({
      schemaVersionId: previousVersion.id,
      serviceName,
    });

    return schemaLog?.sdl ?? null;
  }

  async getIsValid(schemaVersion: SchemaVersion) {
    return schemaVersion.isComposable && schemaVersion.hasContractCompositionErrors === false;
  }

  /**
   * There's a possibility that the composite schema SDL contains parts of the supergraph spec.
   * This is a problem because we want to show the public schema to the user, and the supergraph spec is not part of that.
   * This may happen when composite schema was produced with an old version of `transformSupergraphToPublicSchema`
   * or when supergraph sdl contained something new.
   *
   * This function will check if the SDL contains supergraph spec and if it does, it will transform it to public schema.
   */
  private autoFixCompositeSchemaSdl(sdl: string, versionId: string) {
    if (containsSupergraphSpec(sdl)) {
      this.logger.warn(
        'Composite schema SDL contains supergraph spec, transforming to public schema (versionId: %s)',
        versionId,
      );
      const transformedSdl = print(
        transformSupergraphToPublicSchema(parseGraphQLSource(sdl, 'autoFixCompositeSchemaSdl')),
      );

      this.logger.debug(
        transformedSdl === sdl
          ? 'Transformation did not change the original SDL'
          : 'Transformation changed the original SDL',
      );

      return transformedSdl;
    }

    return sdl;
  }
}
