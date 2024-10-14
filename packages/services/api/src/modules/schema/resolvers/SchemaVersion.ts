import { createPeriod, parseDateRangeInput } from '../../../shared/helpers';
import { buildASTSchema } from '../../../shared/schema';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { onlyDeprecatedDocumentNode } from '../lib/deprecated-graphql';
import { extractSuperGraphInformation } from '../lib/federation-super-graph';
import { stripUsedSchemaCoordinatesFromDocumentNode } from '../lib/unused-graphql';
import { ContractsManager } from '../providers/contracts-manager';
import { SchemaManager } from '../providers/schema-manager';
import { SchemaVersionHelper } from '../providers/schema-version-helper';
import type { SchemaVersionResolvers } from './../../../__generated__/types.next';

export const SchemaVersion: SchemaVersionResolvers = {
  isComposable: version => {
    return version.schemaCompositionErrors === null;
  },
  hasSchemaChanges: async (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getHasSchemaChanges(version);
  },
  log: async (version, _, { injector }) => {
    const log = await injector.get(SchemaManager).getSchemaLog({
      commit: version.actionId,
      organization: version.organization,
      project: version.project,
      target: version.target,
    });

    if (log.kind === 'single') {
      return {
        __typename: 'PushedSchemaLog',
        author: log.author,
        commit: log.commit,
        date: log.date as any,
        id: log.id,
        service: null,
        serviceSdl: null,
      };
    }

    if (log.action === 'DELETE') {
      return {
        __typename: 'DeletedSchemaLog',
        author: 'system',
        commit: 'system',
        date: log.date as any,
        id: log.id,
        deletedService: log.service_name,
        previousServiceSdl: await injector
          .get(SchemaVersionHelper)
          .getServiceSdlForPreviousVersionService(version, log.service_name),
      };
    }

    return {
      __typename: 'PushedSchemaLog',
      author: log.author,
      commit: log.commit,
      date: log.date as any,
      id: log.id,
      service: log.service_name,
      serviceSdl: log.sdl,
      previousServiceSdl: await injector
        .get(SchemaVersionHelper)
        .getServiceSdlForPreviousVersionService(version, log.service_name),
    };
  },
  schemas: (version, _, { injector }) => {
    return injector.get(SchemaManager).getMaybeSchemasOfVersion({
      version: version.id,
      organization: version.organization,
      project: version.project,
      target: version.target,
    });
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
        period: usage?.period ? parseDateRangeInput(usage.period) : createPeriod('30d'),
        organization: version.organization,
        project: version.project,
        target: version.target,
      },
      supergraph,
    };
  },
  unusedSchema: async (version, { usage }, { injector }) => {
    const [schemaAst, supergraphAst] = await Promise.all([
      injector.get(SchemaVersionHelper).getCompositeSchemaAst(version),
      injector.get(SchemaVersionHelper).getSupergraphAst(version),
    ]);

    if (!schemaAst) {
      return null;
    }

    const usedCoordinates = await injector.get(OperationsManager).getReportedSchemaCoordinates({
      targetId: version.target,
      projectId: version.project,
      organizationId: version.organization,
      period: usage?.period ? parseDateRangeInput(usage.period) : createPeriod('30d'),
    });

    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    return {
      sdl: stripUsedSchemaCoordinatesFromDocumentNode(schemaAst, usedCoordinates),
      usage: {
        period: usage?.period ? parseDateRangeInput(usage.period) : createPeriod('30d'),
        organization: version.organization,
        project: version.project,
        target: version.target,
        usedCoordinates,
      },
      supergraph,
    };
  },
  deprecatedSchema: async (version, { usage }, { injector }) => {
    const [schemaAst, supergraphAst] = await Promise.all([
      injector.get(SchemaVersionHelper).getCompositeSchemaAst(version),
      injector.get(SchemaVersionHelper).getSupergraphAst(version),
    ]);

    if (!schemaAst) {
      return null;
    }

    const supergraph = supergraphAst ? extractSuperGraphInformation(supergraphAst) : null;

    return {
      sdl: onlyDeprecatedDocumentNode(schemaAst),
      usage: {
        period: usage?.period ? parseDateRangeInput(usage.period) : createPeriod('30d'),
        organization: version.organization,
        project: version.project,
        target: version.target,
      },
      supergraph,
    };
  },
  date: version => version.createdAt,
  githubMetadata: (version, _, { injector }) => {
    return injector.get(SchemaManager).getGitHubMetadata(version);
  },
  valid: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getIsValid(version);
  },
  previousDiffableSchemaVersion: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getPreviousDiffableSchemaVersion(version);
  },
  isFirstComposableVersion: (version, _, { injector }) => {
    return injector.get(SchemaVersionHelper).getIsFirstComposableVersion(version);
  },
  contractVersions: (version, _, { injector }) => {
    return injector.get(ContractsManager).getContractVersionsForSchemaVersion(version);
  },
};
