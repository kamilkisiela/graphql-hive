import { buildASTSchema } from '../../../shared/schema';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { Logger } from '../../shared/providers/logger';
import { onlyDeprecatedDocumentNode } from '../lib/deprecated-graphql';
import { extractSuperGraphInformation } from '../lib/federation-super-graph';
import { stripUsedSchemaCoordinatesFromDocumentNode } from '../lib/unused-graphql';
import { Contracts } from '../providers/contracts';
import { SchemaManager } from '../providers/schema-manager';
import { SchemaVersionHelper } from '../providers/schema-version-helper';
import type { SchemaVersionResolvers } from './../../../__generated__/types';

export const SchemaVersion: SchemaVersionResolvers = {
  isComposable: version => {
    return version.schemaCompositionErrors === null;
  },
  hasSchemaChanges: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getHasSchemaChanges(version);
  },
  log: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getGraphQLRegistryLogForSchemaVersion(version);
  },
  schemas: (version, _, { injector }) => {
    return injector.get(SchemaManager).getMaybeSchemasOfVersion(version);
  },
  serviceNames: (version, _, { injector }) => {
    return injector.get(SchemaManager).getServiceNamesOfVersion(version);
  },
  schemaCompositionErrors: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getSchemaCompositionErrors(version);
  },
  breakingSchemaChanges: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getBreakingSchemaChanges(version);
  },
  safeSchemaChanges: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getSafeSchemaChanges(version);
  },
  schemaChanges: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getAllSchemaChanges(version);
  },
  supergraph: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getSupergraphSdl(version);
  },
  sdl: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getCompositeSchemaSdl(version);
  },
  baseSchema: async version => {
    return version.baseSchema ?? null;
  },
  explorer: async (version, { usage }, { injector }) => {
    // Checked before the schema work, so a bad period fails once and early.
    const period = await injector
      .get(OperationsManager)
      .usagePeriod({ organizationId: version.organizationId }, usage?.period);
    // @todo use graphql resolve info to optimize this query
    const [schemaAst, supergraphAst] = await Promise.all([
      injector.get(SchemaVersionHelper).getCompositeSchemaAst(version),
      injector.get(SchemaVersionHelper).getSupergraphAst(version),
    ]);

    if (!schemaAst) {
      return null;
    }

    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    return {
      schema: buildASTSchema(schemaAst),
      usage: {
        period,
        organizationId: version.organizationId,
        projectId: version.projectId,
        targetId: version.targetId,
      },
      supergraph: {
        schemaCoordinateMetadataMappings: version.schemaMetadata
          ? new Map(Object.entries(version.schemaMetadata))
          : null,
        schemaCoordinateServicesMappings: supergraph?.schemaCoordinateServicesMappings ?? new Map(),
        metadataAttributes: version.metadataAttributes
          ? Object.entries(version.metadataAttributes).map(([name, values]) => ({ name, values }))
          : null,
      },
    };
  },
  unusedSchema: async (version, args, { injector }) => {
    const [schemaAst, supergraphAst] = await Promise.all([
      injector.get(SchemaVersionHelper).getCompositeSchemaAst(version),
      injector.get(SchemaVersionHelper).getSupergraphAst(version),
    ]);

    if (!schemaAst) {
      return null;
    }

    const period = await injector
      .get(OperationsManager)
      .usagePeriod({ organizationId: version.organizationId }, args.period?.absoluteRange);

    const usedCoordinates = await injector.get(OperationsManager).getReportedSchemaCoordinates({
      targetId: version.targetId,
      projectId: version.projectId,
      organizationId: version.organizationId,
      period,
    });

    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    return {
      sdl: stripUsedSchemaCoordinatesFromDocumentNode(schemaAst, usedCoordinates),
      usage: {
        period,
        organizationId: version.organizationId,
        projectId: version.projectId,
        targetId: version.targetId,
        usedCoordinates,
      },
      supergraph: {
        schemaCoordinateMetadataMappings: version.schemaMetadata
          ? new Map(Object.entries(version.schemaMetadata))
          : null,
        schemaCoordinateServicesMappings: supergraph?.schemaCoordinateServicesMappings ?? new Map(),
        metadataAttributes: version.metadataAttributes
          ? Object.entries(version.metadataAttributes).map(([name, values]) => ({ name, values }))
          : null,
      },
    };
  },
  deprecatedSchema: async (version, args, { injector }) => {
    const logger = injector.get(Logger);

    logger.debug(
      'Build deprecated schema explorer. (organizationId=%s, projectId=%s, targetId=%s, schemaVersionId=%s)',
      version.organizationId,
      version.projectId,
      version.targetId,
      version.id,
    );

    const [schemaAst, supergraphAst] = await Promise.all([
      injector.get(SchemaVersionHelper).getCompositeSchemaAst(version),
      injector.get(SchemaVersionHelper).getSupergraphAst(version),
    ]);

    if (!schemaAst) {
      return null;
    }

    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    const period = await injector
      .get(OperationsManager)
      .usagePeriod({ organizationId: version.organizationId }, args.period?.absoluteRange);

    logger.debug(
      'Start filtering full schema SDL into deprecated schema SDL. (organizationId=%s, projectId=%s, targetId=%s, schemaVersionId=%s)',
      version.organizationId,
      version.projectId,
      version.targetId,
      version.id,
    );

    const filteredSdl = onlyDeprecatedDocumentNode(schemaAst);

    logger.debug(
      'Finished filtering full schema SDL into deprecated schema SDL. (organizationId=%s, projectId=%s, targetId=%s, schemaVersionId=%s)',
      version.organizationId,
      version.projectId,
      version.targetId,
      version.id,
    );

    return {
      sdl: filteredSdl,
      usage: {
        period,
        organizationId: version.organizationId,
        projectId: version.projectId,
        targetId: version.targetId,
      },
      supergraph: {
        schemaCoordinateMetadataMappings: version.schemaMetadata
          ? new Map(Object.entries(version.schemaMetadata))
          : null,
        schemaCoordinateServicesMappings: supergraph?.schemaCoordinateServicesMappings ?? new Map(),
        metadataAttributes: version.metadataAttributes
          ? Object.entries(version.metadataAttributes).map(([name, values]) => ({ name, values }))
          : null,
      },
    };
  },
  date: version => version.createdAt,
  githubMetadata: (version, _, { injector }) => {
    return injector.get(SchemaManager).getGitHubMetadata(version);
  },
  valid: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getIsValid(version);
  },
  isValid: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getIsValid(version);
  },
  previousDiffableSchemaVersion: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getPreviousDiffableSchemaVersion(version);
  },
  isFirstComposableVersion: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getIsFirstComposableVersion(version);
  },
  contractVersions: (version, _, { injector }) => {
    return injector
      .get(Contracts)
      .getContractVersionsForSchemaVersion({ schemaVersionId: version.id });
  },
  subgraphDiffs: async (version, _, { injector }) => {
    return await injector.get(SchemaVersionHelper).getGraphQLSubgraphDiffsForSchemaVersion(version);
  },
  origin: async (version, _, { injector }) => {
    return await injector
      .get(SchemaVersionHelper)
      .getGraphQLSchemaVersionOriginForSchemaVersion(version);
  },
  meta: async (version, _, { injector }) => {
    if (version.meta) {
      return version.meta;
    }

    const log = await injector
      .get(SchemaVersionHelper)
      .getGraphQLRegistryLogForSchemaVersion(version);

    return {
      author: log.author ?? null,
      commit: log.commit ?? null,
    };
  },
};
