import { Injectable, Scope } from 'graphql-modules';
import { DocumentNode } from 'graphql/language/ast';
import { CriticalityLevel } from '@graphql-inspector/core';
import type { SchemaChangeType } from '@hive/storage';
import { ProjectType, type ComposeAndValidateResult } from '../../../shared/entities';
import { SchemaVersion } from '../../../shared/mappers';
import { parseGraphQLSource } from '../../../shared/schema';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
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
  compositionCache = new WeakMap<SchemaVersion, Promise<null | ComposeAndValidateResult>>();
  compositeSchemaAstCache = new WeakMap<SchemaVersion, null | DocumentNode>();
  supergraphAstCache = new WeakMap<SchemaVersion, null | DocumentNode>();
  schemaChangesCache = new WeakMap<
    SchemaVersion,
    Promise<null | {
      safe: Array<SchemaChangeType> | null;
      breaking: Array<SchemaChangeType> | null;
    }>
  >();

  constructor(
    private schemaManager: SchemaManager,
    private schemaHelper: SchemaHelper,
    private projectManager: ProjectManager,
    private organizationManager: OrganizationManager,
    private registryChecks: RegistryChecks,
    private storage: Storage,
  ) {}

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
      },
    );

    return validation;
  }

  private getOrComposeSchemaVersion(schemaVersion: SchemaVersion) {
    let promise = this.compositionCache.get(schemaVersion);
    if (!promise) {
      promise = this.composeSchemaVersion(schemaVersion);
      this.compositionCache.set(schemaVersion, promise);
    }

    return promise;
  }

  async getSchemaCompositionErrors(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.schemaCompositionErrors;
    }

    const composition = await this.getOrComposeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.errors?.length ? composition.errors : null;
  }

  async getCompositeSchemaSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.compositeSchemaSDL;
    }

    const composition = await this.getOrComposeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.sdl ?? null;
  }

  async getSupergraphSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.supergraphSDL;
    }

    const composition = await this.getOrComposeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.supergraph ?? null;
  }

  async getCompositeSchemaAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getCompositeSchemaSdl(schemaVersion);
    if (compositeSchemaSdl === null) {
      return null;
    }

    let compositeSchemaAst = this.compositeSchemaAstCache.get(schemaVersion);
    if (compositeSchemaAst === undefined) {
      compositeSchemaAst = parseGraphQLSource(
        compositeSchemaSdl,
        'parse composite schema sdl in SchemaVersionHelper.getCompositeSchemaAst',
      );
      this.compositeSchemaAstCache.set(schemaVersion, compositeSchemaAst);
    }

    return compositeSchemaAst;
  }

  async getSupergraphAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getSupergraphSdl(schemaVersion);
    if (compositeSchemaSdl === null) {
      return null;
    }

    let compositeSchemaAst = this.supergraphAstCache.get(schemaVersion);
    if (compositeSchemaAst === undefined) {
      compositeSchemaAst = parseGraphQLSource(
        compositeSchemaSdl,
        'parse supergraph sdl in SchemaVersionHelper.getSupergraphAst',
      );
      this.supergraphAstCache.set(schemaVersion, compositeSchemaAst);
    }

    return compositeSchemaAst;
  }

  private async computeSchemaChanges(schemaVersion: SchemaVersion) {
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

  private async getOrComputeSchemaChanges(schemaVersion: SchemaVersion) {
    let promise = this.schemaChangesCache.get(schemaVersion);
    if (!promise) {
      promise = this.computeSchemaChanges(schemaVersion);
      this.schemaChangesCache.set(schemaVersion, promise);
    }

    return promise;
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
    const changes = await this.getOrComputeSchemaChanges(schemaVersion);
    return changes?.breaking ?? null;
  }

  async getSafeSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this.getOrComputeSchemaChanges(schemaVersion);
    return changes?.safe ?? null;
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
}
