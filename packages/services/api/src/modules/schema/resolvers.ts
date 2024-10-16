import { createHash } from 'node:crypto';
import type {
  GraphQLEnumTypeMapper,
  GraphQLInputObjectTypeMapper,
  GraphQLInterfaceTypeMapper,
  GraphQLNamedTypeMapper,
  GraphQLObjectTypeMapper,
  GraphQLScalarTypeMapper,
  GraphQLUnionTypeMapper,
  SchemaCoordinateUsageForUnusedExplorer,
  SchemaCoordinateUsageMapper,
  WithGraphQLParentInfo,
  WithSchemaCoordinatesUsage,
} from './module.graphql.mappers';
import stringify from 'fast-json-stable-stringify';
import {
  ConstDirectiveNode,
  DEFAULT_DEPRECATION_REASON,
  DocumentNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  Kind,
  print,
} from 'graphql';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { z } from 'zod';
import { CriticalityLevel } from '@graphql-inspector/core';
import type * as Types from '../../__generated__/types';
import { type DateRange } from '../../shared/entities';
import { createPeriod, parseDateRangeInput, PromiseOrValue } from '../../shared/helpers';
import { buildASTSchema, createConnection, createDummyConnection } from '../../shared/schema';
import { AuditLogManager } from '../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { OperationsManager } from '../operations/providers/operations-manager';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetSelector } from '../shared/providers/storage';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { onlyDeprecatedDocumentNode } from './lib/deprecated-graphql';
import { extractSuperGraphInformation, SuperGraphInformation } from './lib/federation-super-graph';
import { stripUsedSchemaCoordinatesFromDocumentNode } from './lib/unused-graphql';
import { BreakingSchemaChangeUsageHelper } from './providers/breaking-schema-changes-helper';
import { ContractsManager } from './providers/contracts-manager';
import { SchemaCheckManager } from './providers/schema-check-manager';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { SchemaVersionHelper } from './providers/schema-version-helper';
import { toGraphQLSchemaCheck, toGraphQLSchemaCheckCurry } from './to-graphql-schema-check';

const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);
const GraphQLSchemaStringModel = z.string().max(5_000_000).min(0);

function isSchemaCoordinateUsageForUnusedExplorer(
  value: unknown,
): value is SchemaCoordinateUsageForUnusedExplorer {
  return 'isUsed' in (value as any);
}

function usage(
  source:
    | WithSchemaCoordinatesUsage<{
        entity: {
          name: string;
        };
      }>
    | WithGraphQLParentInfo<
        WithSchemaCoordinatesUsage<{
          entity: {
            name: string;
          };
        }>
      >,
  _: unknown,
): Promise<SchemaCoordinateUsageMapper> | SchemaCoordinateUsageMapper {
  const coordinate =
    'parent' in source ? `${source.parent.coordinate}.${source.entity.name}` : source.entity.name;

  const usage = source.usage();

  if (isSchemaCoordinateUsageForUnusedExplorer(usage)) {
    if (usage.usedCoordinates.has(coordinate)) {
      return {
        // TODO: This is a hack to mark the field as used but without passing exact number as we don't need the exact number in "Unused schema view".
        total: 1,
        isUsed: true,
        usedByClients: () => [],
        period: usage.period,
        organization: usage.organization,
        project: usage.project,
        target: usage.target,
        coordinate: coordinate,
      };
    }

    return {
      total: 0,
      isUsed: false,
      usedByClients: () => [],
    };
  }

  return Promise.resolve(usage).then(usage => {
    const coordinateUsage = usage[coordinate];

    return coordinateUsage && coordinateUsage.total > 0
      ? {
          total: coordinateUsage.total,
          isUsed: true,
          usedByClients: coordinateUsage.usedByClients,
          period: coordinateUsage.period,
          organization: coordinateUsage.organization,
          project: coordinateUsage.project,
          target: coordinateUsage.target,
          coordinate: coordinate,
        }
      : {
          total: 0,
          isUsed: false,
          usedByClients: () => [],
        };
  });
}

function __isTypeOf<
  T extends GraphQLNamedTypeMapper,
  K extends GraphQLNamedTypeMapper['entity']['kind'],
>(kind: K): (type: T) => boolean {
  return ({ entity }: { entity: GraphQLNamedTypeMapper['entity'] }) => entity.kind === kind;
}

export const resolvers: SchemaModule.Resolvers = {
  Mutation: {
    async schemaCheck(_, { input }, { injector }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      const result = await injector.get(SchemaPublisher).check({
        ...input,
        service: input.service?.toLowerCase(),
        organization,
        project,
        target,
      });

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const [organizationId, projectId, targetId] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId({
          organization,
        }),
        injector.get(IdTranslator).translateProjectId({
          organization,
          project,
        }),
        injector.get(IdTranslator).translateTargetId({
          organization,
          project,
          target,
        }),
      ]);
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'SCHEMA_CHECKED',
          schemaCheckedAuditLogSchema: {
            projectId: projectId,
            targetId: targetId,
            checkId: result.__typename === 'SchemaCheckSuccess' ? result.schemaCheck.id : null,
          },
        },
        {
          organizationId: organizationId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      if ('changes' in result && result.changes) {
        return {
          ...result,
          changes: result.changes,
          errors:
            result.errors?.map(error => ({
              ...error,
              path: 'path' in error ? error.path?.split('.') : null,
            })) ?? [],
        };
      }

      return result;
    },
    async approveFailedSchemaCheck(_, { input }, { injector }) {
      const [organizationId, projectId, targetId] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId(input),
        injector.get(IdTranslator).translateProjectId(input),
        injector.get(IdTranslator).translateTargetId(input),
      ]);

      const result = await injector.get(SchemaManager).approveFailedSchemaCheck({
        organizationId,
        projectId,
        targetId,
        schemaCheckId: input.schemaCheckId,
        comment: input.comment,
      });

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'SCHEMA_CHECKED',
          schemaCheckedAuditLogSchema: {
            projectId: projectId,
            targetId: targetId,
            checkId: input.schemaCheckId,
          },
        },
        {
          organizationId: organizationId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      if (result.type === 'error') {
        return {
          error: {
            message: result.reason,
          },
        };
      }

      return {
        ok: {
          schemaCheck: toGraphQLSchemaCheck(
            {
              organizationId,
              projectId,
            },
            result.schemaCheck,
          ),
        },
      };
    },
    async schemaPublish(_, { input }, { injector, request }, info) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      // We only want to resolve to SchemaPublishMissingUrlError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingUrlError' is becomes pretty low.
      const parsedResolveInfoFragment = parseResolveInfo(info);
      const isSchemaPublishMissingUrlErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingUrlError'];

      const result = await injector.get(SchemaPublisher).publish(
        {
          ...input,
          service: input.service?.toLowerCase(),
          organization,
          project,
          target,
          isSchemaPublishMissingUrlErrorSelected,
        },
        request.signal,
      );

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const [organizationId, projectId, targetId] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId({
          organization,
        }),
        injector.get(IdTranslator).translateProjectId({
          organization,
          project,
        }),
        injector.get(IdTranslator).translateTargetId({
          organization,
          project,
          target,
        }),
      ]);
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'SCHEMA_PUBLISH',
          schemaPublishAuditLogSchema: {
            projectId: projectId,
            targetId: targetId,
            isSchemaPublishMissingUrlErrorSelected,
            serviceName: input?.service?.toLowerCase(),
          },
        },
        {
          organizationId: organizationId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      if ('changes' in result) {
        return {
          ...result,
          changes: result.changes,
        };
      }

      return result;
    },
    async schemaDelete(_, { input }, { injector, request }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetFromToken(),
      ]);

      const token = injector.get(AuthManager).ensureApiToken();

      const checksum = createHash('md5')
        .update(
          stringify({
            ...input,
            serviceName: input.serviceName.toLowerCase(),
          }),
        )
        .update(token)
        .digest('base64');

      const result = await injector.get(SchemaPublisher).delete(
        {
          dryRun: input.dryRun,
          serviceName: input.serviceName.toLowerCase(),
          organization,
          project,
          target,
          checksum,
        },
        request.signal,
      );

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const [organizationId, projectId] = await Promise.all([
        injector.get(IdTranslator).translateOrganizationId({
          organization,
        }),
        injector.get(IdTranslator).translateProjectId({
          organization,
          project,
        }),
      ]);
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'SCHEMA_DELETED',
          schemaDeletedAuditLogSchema: {
            projectId: projectId,
            serviceName: input.serviceName.toLowerCase(),
            targetId: target.id,
          },
        },
        {
          organizationId: organizationId,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return {
        ...result,
        changes: result.changes,
        errors: result.errors?.map(error => ({
          ...error,
          path: 'path' in error ? error.path?.split('.') : null,
        })),
      };
    },
    async schemaCompose(_, { input }, { injector }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      const result = await injector.get(SchemaManager).compose({
        onlyComposable: input.useLatestComposableVersion === true,
        services: input.services,
        organization,
        project,
        target,
      });

      if (result.kind === 'error') {
        return {
          __typename: 'SchemaComposeError',
          message: result.message,
        };
      }

      return {
        __typename: 'SchemaComposeSuccess',
        valid: 'supergraphSDL' in result && result.supergraphSDL !== null,
        compositionResult: {
          errors: result.errors,
          supergraphSdl: result.supergraphSDL,
        },
      };
    },
    async updateSchemaVersionStatus(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      return injector.get(SchemaPublisher).updateVersionStatus({
        version: input.version,
        valid: input.valid,
        organization,
        project,
        target,
      });
    },
    async updateBaseSchema(_, { input }, { injector }) {
      const UpdateBaseSchemaModel = z.object({
        newBase: MaybeModel(GraphQLSchemaStringModel),
      });

      const result = UpdateBaseSchemaModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message:
              result.error.formErrors.fieldErrors?.newBase?.[0] ?? 'Please check your input.',
          },
        };
      }

      const schemaManager = injector.get(SchemaManager);
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const selector = { organization, project, target };
      await schemaManager.updateBaseSchema(selector, input.newBase ? input.newBase : null);

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'TARGET_SETTINGS_UPDATED',
          targetSettingsUpdatedAuditLogSchema: {
            targetId: target,
            projectId: project,
            updatedFields: JSON.stringify({
              newBase: input.newBase,
            }),
          },
        },
        {
          organizationId: organization,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return {
        ok: {
          updatedTarget: await injector.get(TargetManager).getTarget({
            organization,
            target,
            project,
          }),
        },
      };
    },
    async disableExternalSchemaComposition(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      const result = injector.get(SchemaManager).disableExternalSchemaComposition({
        project,
        organization,
      });

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'ORGANIZATION_SETTINGS_UPDATED',
          organizationSettingsUpdatedAuditLogSchema: {
            updatedFields: JSON.stringify({
              disableExternalSchemaComposition: true,
            }),
          },
        },
        {
          organizationId: organization,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return result;
    },
    async enableExternalSchemaComposition(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      const result = injector.get(SchemaManager).enableExternalSchemaComposition({
        project,
        organization,
        endpoint: input.endpoint,
        secret: input.secret,
      });

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'ORGANIZATION_SETTINGS_UPDATED',
          organizationSettingsUpdatedAuditLogSchema: {
            updatedFields: JSON.stringify({
              disableExternalSchemaComposition: false,
            }),
          },
        },
        {
          organizationId: organization,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return result;
    },
    async updateNativeFederation(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      const result = {
        ok: await injector.get(SchemaManager).updateNativeSchemaComposition({
          project,
          organization,
          enabled: input.enabled,
        }),
      };

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      injector.get(AuditLogManager).createLogAuditEvent(
        {
          eventType: 'ORGANIZATION_SETTINGS_UPDATED',
          organizationSettingsUpdatedAuditLogSchema: {
            updatedFields: JSON.stringify({
              enableNativeFederation: input.enabled,
            }),
          },
        },
        {
          organizationId: organization,
          userEmail: currentUser.email,
          userId: currentUser.id,
          user: currentUser,
        },
      );

      return result;
    },
    async updateProjectRegistryModel(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return {
        ok: await injector.get(SchemaManager).updateRegistryModel({
          project,
          organization,
          model: input.model,
        }),
      };
    },
    async createContract(_, args, context) {
      const result = await context.injector.get(ContractsManager).createContract({
        contract: {
          targetId: args.input.targetId,
          contractName: args.input.contractName,
          excludeTags: (args.input.excludeTags as Array<string> | null) ?? null,
          includeTags: (args.input.includeTags as Array<string> | null) ?? null,
          removeUnreachableTypesFromPublicApiSchema:
            args.input.removeUnreachableTypesFromPublicApiSchema,
        },
      });

      if (result.type === 'success') {
        return {
          ok: {
            createdContract: result.contract,
          },
        };
      }

      return {
        error: {
          message: 'Something went wrong.',
          details: result.errors,
        },
      };
    },
    async disableContract(_, args, context) {
      const result = await context.injector.get(ContractsManager).disableContract({
        contractId: args.input.contractId,
      });

      if (result.type === 'success') {
        return {
          ok: {
            disabledContract: result.contract,
          },
        };
      }

      return {
        error: {
          message: result.message,
        },
      };
    },
  },
  Query: {
    async latestVersion(_, __, { injector }) {
      const target = await injector.get(TargetManager).getTargetFromToken();

      return injector.get(SchemaManager).getMaybeLatestVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
    async latestValidVersion(_, __, { injector }) {
      const target = await injector.get(TargetManager).getTargetFromToken();

      return injector.get(SchemaManager).getMaybeLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
    async testExternalSchemaComposition(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organizationId, projectId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
      ]);

      const schemaManager = injector.get(SchemaManager);

      const result = await schemaManager.testExternalSchemaComposition({
        organizationId,
        projectId,
      });

      if (result.kind === 'success') {
        return {
          ok: result.project,
        };
      }

      return {
        error: {
          message: result.error,
        },
      };
    },
    async schemaVersionForActionId(_, { actionId }, { injector }) {
      return injector.get(SchemaManager).getSchemaVersionByActionId({
        actionId,
      });
    },
  },
  Target: {
    async schemaVersions(target, args, { injector }) {
      return injector.get(SchemaManager).getPaginatedSchemaVersionsForTargetId({
        targetId: target.id,
        organizationId: target.orgId,
        projectId: target.projectId,
        cursor: args.after ?? null,
        first: args.first ?? null,
      });
    },
    async schemaVersion(target, args, { injector }) {
      const schemaVersion = await injector.get(SchemaManager).getSchemaVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
        version: args.id,
      });

      if (schemaVersion === null) {
        return null;
      }

      return {
        ...schemaVersion,
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      };
    },
    latestSchemaVersion(target, _, { injector }) {
      return injector.get(SchemaManager).getMaybeLatestVersion({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
    async latestValidSchemaVersion(target, __, { injector }) {
      return injector.get(SchemaManager).getMaybeLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
    baseSchema(target, _, { injector }) {
      return injector.get(SchemaManager).getBaseSchema({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
    hasSchema(target, _, { injector }) {
      return injector.get(SchemaManager).hasSchema({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
    async schemaCheck(target, args, { injector }) {
      const schemaCheck = await injector.get(SchemaManager).findSchemaCheck({
        targetId: target.id,
        projectId: target.projectId,
        organizationId: target.orgId,
        schemaCheckId: args.id,
      });

      if (schemaCheck == null) {
        return null;
      }

      return toGraphQLSchemaCheck(
        {
          organizationId: target.orgId,
          projectId: target.projectId,
        },
        schemaCheck,
      );
    },
    async schemaChecks(target, args, { injector }) {
      const result = await injector.get(SchemaManager).getPaginatedSchemaChecksForTarget({
        targetId: target.id,
        projectId: target.projectId,
        organizationId: target.orgId,
        first: args.first ?? null,
        cursor: args.after ?? null,
        filters: args.filters ?? null,
        transformNode: toGraphQLSchemaCheckCurry({
          organizationId: target.orgId,
          projectId: target.projectId,
        }),
      });

      return {
        edges: result.items,
        pageInfo: result.pageInfo,
      };
    },
    schemaVersionsCount(target, { period }, { injector }) {
      return injector.get(SchemaManager).countSchemaVersionsOfTarget({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
        period: period ? parseDateRangeInput(period) : null,
      });
    },
    async contracts(target, args, { injector }) {
      return await injector.get(ContractsManager).getPaginatedContractsForTarget({
        target,
        cursor: args.after ?? null,
        first: args.first ?? null,
      });
    },
    async activeContracts(target, args, { injector }) {
      return await injector.get(ContractsManager).getPaginatedActiveContractsForTarget({
        target,
        cursor: args.after ?? null,
        first: args.first ?? null,
      });
    },
    async hasCollectedSubscriptionOperations(target, _, { injector }) {
      return await injector.get(OperationsManager).hasCollectedSubscriptionOperations({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
      });
    },
  },
  SchemaVersion: {
    isComposable(version) {
      return version.schemaCompositionErrors === null;
    },
    hasSchemaChanges(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getHasSchemaChanges(version);
    },
    async log(version, _, { injector }) {
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
    schemas(version, _, { injector }) {
      return injector.get(SchemaManager).getMaybeSchemasOfVersion({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });
    },
    async schemaCompositionErrors(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getSchemaCompositionErrors(version);
    },
    async breakingSchemaChanges(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getBreakingSchemaChanges(version);
    },
    async safeSchemaChanges(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getSafeSchemaChanges(version);
    },
    async supergraph(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getSupergraphSdl(version);
    },
    async sdl(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getCompositeSchemaSdl(version);
    },
    async baseSchema(version) {
      return version.baseSchema ?? null;
    },
    async explorer(version, { usage }, { injector }) {
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
    async unusedSchema(version, { usage }, { injector }) {
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
    async deprecatedSchema(version, { usage }, { injector }) {
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
    githubMetadata(version, _, { injector }) {
      return injector.get(SchemaManager).getGitHubMetadata(version);
    },
    valid(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getIsValid(version);
    },
    previousDiffableSchemaVersion(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getPreviousDiffableSchemaVersion(version);
    },
    isFirstComposableVersion(version, _, { injector }) {
      return injector.get(SchemaVersionHelper).getIsFirstComposableVersion(version);
    },
    contractVersions(version, _, { injector }) {
      return injector.get(ContractsManager).getContractVersionsForSchemaVersion(version);
    },
  },
  SingleSchema: {
    __isTypeOf(obj) {
      return obj.kind === 'single';
    },
    source(schema) {
      return schema.sdl;
    },
  },
  CompositeSchema: {
    __isTypeOf(obj) {
      return obj.kind === 'composite' && obj.action === 'PUSH';
    },
    service(schema) {
      return schema.service_name;
    },
    source(schema) {
      return schema.sdl;
    },
    url(schema) {
      return schema.service_url;
    },
  },
  SchemaConnection: createConnection(),
  SchemaChangeConnection: createConnection(),
  SchemaChange: {
    message: (change, args) => {
      return args.withSafeBasedOnUsageNote && change.isSafeBasedOnUsage === true
        ? `${change.message} (non-breaking based on usage)`
        : change.message;
    },
    path: change => change.path?.split('.') ?? null,
    criticality: change => criticalityMap[change.criticality],
    criticalityReason: change => change.reason,
    approval: change => change.approvalMetadata,
    isSafeBasedOnUsage: change => change.isSafeBasedOnUsage,
    usageStatistics: (change, _, { injector }) =>
      injector.get(BreakingSchemaChangeUsageHelper).getUsageDataForBreakingSchemaChange(change),
  },
  SchemaChangeApproval: {
    approvedBy: (approval, _, { injector }) =>
      injector.get(SchemaManager).getUserForSchemaChangeById({ userId: approval.userId }),
    approvedAt: approval => approval.date,
  },
  SchemaErrorConnection: createConnection(),
  SchemaWarningConnection: createConnection(),
  SchemaCheckSuccess: {
    __isTypeOf(obj) {
      return obj.valid;
    },
  },
  SchemaCheckError: {
    __isTypeOf(obj) {
      return !obj.valid;
    },
  },
  Project: {
    externalSchemaComposition(project) {
      if (project.externalComposition.enabled && project.externalComposition.endpoint) {
        return {
          endpoint: project.externalComposition.endpoint,
        };
      }

      return null;
    },
    registryModel(project) {
      return project.legacyRegistryModel ? 'LEGACY' : 'MODERN';
    },
    schemaVersionsCount(project, { period }, { injector }) {
      return injector.get(SchemaManager).countSchemaVersionsOfProject({
        organization: project.orgId,
        project: project.id,
        period: period ? parseDateRangeInput(period) : null,
      });
    },
    isNativeFederationEnabled(project) {
      return project.nativeFederation === true;
    },
    nativeFederationCompatibility(project, _, { injector }) {
      return injector.get(SchemaManager).getNativeFederationCompatibilityStatus(project);
    },
  },
  SchemaCoordinateUsage: {
    topOperations(source, { limit }, { injector }) {
      if (!source.isUsed) {
        return [];
      }

      return injector
        .get(OperationsManager)
        .getTopOperationForCoordinate({
          organizationId: source.organization,
          projectId: source.project,
          targetId: source.target,
          coordinate: source.coordinate,
          period: source.period,
          limit,
        })
        .then(operations =>
          operations.map(op => ({
            name: op.operationName,
            hash: op.operationHash,
            count: op.count,
          })),
        );
    },
    // Why? GraphQL-JIT goes crazy without this (Expected Iterable, but did not find one for field SchemaCoordinateUsage.usedByClients).
    // That's why we switched from a getter to a function.
    usedByClients(parent) {
      return parent.usedByClients();
    },
  },
  SchemaExplorer: {
    async type(source, { name }, { injector }) {
      const entity = source.schema.getType(name);
      const operationsManager = injector.get(OperationsManager);

      if (!entity) {
        return null;
      }

      const { supergraph } = source;
      const usage = () =>
        injector
          .get(OperationsManager)
          .countCoordinatesOfType({
            typename: entity.name,
            organization: source.usage.organization,
            project: source.usage.project,
            target: source.usage.target,
            period: source.usage.period,
          })
          .then(usage =>
            withUsedByClients(usage, {
              selector: source.usage,
              period: source.usage.period,
              operationsManager,
              typename: entity.name,
            }),
          );

      if (isObjectType(entity)) {
        return {
          entity: transformGraphQLObjectType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                getFieldOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                  null,
              }
            : null,
        } satisfies GraphQLObjectTypeMapper;
      }
      if (isInterfaceType(entity)) {
        return {
          entity: transformGraphQLInterfaceType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                getFieldOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                  null,
              }
            : null,
        } satisfies GraphQLInterfaceTypeMapper;
      }
      if (isEnumType(entity)) {
        return {
          entity: transformGraphQLEnumType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                getEnumValueOwnedByServices: (fieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                  null,
              }
            : null,
        } satisfies GraphQLEnumTypeMapper;
      }
      if (isUnionType(entity)) {
        return {
          entity: transformGraphQLUnionType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                getUnionMemberOwnedByServices: (memberName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
              }
            : null,
        } satisfies GraphQLUnionTypeMapper;
      }
      if (isInputObjectType(entity)) {
        return {
          entity: transformGraphQLInputObjectType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                getInputFieldOwnedByServices: (inputFieldName: string) =>
                  supergraph.schemaCoordinateServicesMappings.get(
                    `${entity.name}.${inputFieldName}`,
                  ) ?? null,
              }
            : null,
        } satisfies GraphQLInputObjectTypeMapper;
      }
      if (isScalarType(entity)) {
        return {
          entity: transformGraphQLScalarType(entity),
          usage,
          supergraph: supergraph
            ? {
                ownedByServiceNames:
                  supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              }
            : null,
        } satisfies GraphQLScalarTypeMapper;
      }

      throw new Error('Illegal state: unknown type kind');
    },
    async types({ schema, usage, supergraph }, _, { injector }) {
      const types: Array<
        | GraphQLObjectTypeMapper
        | GraphQLInterfaceTypeMapper
        | GraphQLUnionTypeMapper
        | GraphQLEnumTypeMapper
        | GraphQLInputObjectTypeMapper
        | GraphQLScalarTypeMapper
      > = [];
      const typeMap = schema.getTypeMap();
      const operationsManager = injector.get(OperationsManager);

      async function getStats(typename: string) {
        const stats = await operationsManager.countCoordinatesOfTarget({
          target: usage.target,
          organization: usage.organization,
          project: usage.project,
          period: usage.period,
        });

        return withUsedByClients(stats, {
          selector: usage,
          period: usage.period,
          operationsManager,
          typename,
        });
      }

      for (const typename in typeMap) {
        if (typename.startsWith('__')) {
          continue;
        }

        const entity = typeMap[typename];

        if (isObjectType(entity)) {
          types.push({
            entity: transformGraphQLObjectType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                  getFieldOwnedByServices: (fieldName: string) =>
                    supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                    null,
                }
              : null,
          });
        } else if (isInterfaceType(entity)) {
          types.push({
            entity: transformGraphQLInterfaceType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                  getFieldOwnedByServices: (fieldName: string) =>
                    supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                    null,
                }
              : null,
          });
        } else if (isEnumType(entity)) {
          types.push({
            entity: transformGraphQLEnumType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                  getEnumValueOwnedByServices: (fieldName: string) =>
                    supergraph.schemaCoordinateServicesMappings.get(`${typename}.${fieldName}`) ??
                    null,
                }
              : null,
          });
        } else if (isUnionType(entity)) {
          types.push({
            entity: transformGraphQLUnionType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                  getUnionMemberOwnedByServices: (memberName: string) =>
                    supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
                }
              : null,
          });
        } else if (isInputObjectType(entity)) {
          types.push({
            entity: transformGraphQLInputObjectType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(typename) ?? null,
                  getInputFieldOwnedByServices: (inputFieldName: string) =>
                    supergraph.schemaCoordinateServicesMappings.get(
                      `${typename}.${inputFieldName}`,
                    ) ?? null,
                }
              : null,
          });
        } else if (isScalarType(entity)) {
          types.push({
            entity: transformGraphQLScalarType(entity),
            usage() {
              return getStats(entity.name);
            },
            supergraph: supergraph
              ? {
                  ownedByServiceNames:
                    supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
                }
              : null,
          });
        }
      }

      types.sort((a, b) => a.entity.name.localeCompare(b.entity.name));

      return types;
    },
    async query({ schema, supergraph, usage }, _, { injector }) {
      const entity = schema.getQueryType();

      if (!entity) {
        return null;
      }

      const operationsManager = injector.get(OperationsManager);

      return {
        entity: transformGraphQLObjectType(entity),
        usage() {
          return operationsManager
            .countCoordinatesOfType({
              typename: entity.name,
              organization: usage.organization,
              project: usage.project,
              target: usage.target,
              period: usage.period,
            })
            .then(stats =>
              withUsedByClients(stats, {
                selector: usage,
                period: usage.period,
                operationsManager,
                typename: entity.name,
              }),
            );
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      };
    },
    async mutation({ schema, supergraph, usage }, _, { injector }) {
      const entity = schema.getMutationType();

      if (!entity) {
        return null;
      }

      const operationsManager = injector.get(OperationsManager);

      return {
        entity: transformGraphQLObjectType(entity),
        usage() {
          return operationsManager
            .countCoordinatesOfType({
              typename: entity.name,
              organization: usage.organization,
              project: usage.project,
              target: usage.target,
              period: usage.period,
            })
            .then(stats =>
              withUsedByClients(stats, {
                selector: usage,
                period: usage.period,
                operationsManager,
                typename: entity.name,
              }),
            );
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      };
    },

    async subscription({ schema, supergraph, usage }, _, { injector }) {
      const entity = schema.getSubscriptionType();

      if (!entity) {
        return null;
      }

      const operationsManager = injector.get(OperationsManager);

      return {
        entity: transformGraphQLObjectType(entity),
        usage() {
          return operationsManager
            .countCoordinatesOfType({
              typename: entity.name,
              organization: usage.organization,
              project: usage.project,
              target: usage.target,
              period: usage.period,
            })
            .then(stats =>
              withUsedByClients(stats, {
                selector: usage,
                period: usage.period,
                operationsManager,
                typename: entity.name,
              }),
            );
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(entity.name) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(`${entity.name}.${fieldName}`) ??
                null,
            }
          : null,
      };
    },
  },
  DeprecatedSchemaExplorer: {
    types({ sdl, supergraph, usage }, _, { injector }) {
      const operationsManager = injector.get(OperationsManager);

      async function getStats(typename: string) {
        const stats = await operationsManager.countCoordinatesOfTarget({
          target: usage.target,
          organization: usage.organization,
          project: usage.project,
          period: usage.period,
        });

        return withUsedByClients(stats, {
          selector: usage,
          period: usage.period,
          operationsManager,
          typename,
        });
      }

      return buildGraphQLTypesFromSDL(sdl, getStats, supergraph).sort((a, b) =>
        a.entity.name.localeCompare(b.entity.name),
      );
    },
  },
  UnusedSchemaExplorer: {
    types({ sdl, supergraph, usage }) {
      const unused = () =>
        ({
          isUsed: false,
          usedCoordinates: usage.usedCoordinates,
          period: usage.period,
          organization: usage.organization,
          project: usage.project,
          target: usage.target,
        }) as const;

      return buildGraphQLTypesFromSDL(sdl, unused, supergraph).sort((a, b) =>
        a.entity.name.localeCompare(b.entity.name),
      );
    },
  },
  GraphQLObjectType: {
    __isTypeOf: __isTypeOf(Kind.OBJECT_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      t.entity.fields.map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? { ownedByServiceNames: t.supergraph.getFieldOwnedByServices(f.name) }
          : null,
      })),
    interfaces: t => t.entity.interfaces,
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInterfaceType: {
    __isTypeOf: __isTypeOf(Kind.INTERFACE_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      t.entity.fields.map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? { ownedByServiceNames: t.supergraph.getFieldOwnedByServices(f.name) }
          : null,
      })),
    interfaces: t => t.entity.interfaces,
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLUnionType: {
    __isTypeOf: __isTypeOf(Kind.UNION_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    members: t =>
      t.entity.members.map(i => {
        return {
          entity: i,
          usage: t.usage,
          parent: {
            coordinate: t.entity.name,
          },
          supergraph: t.supergraph
            ? {
                ownedByServiceNames: t.supergraph.getUnionMemberOwnedByServices(i.name),
              }
            : null,
        };
      }),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLEnumType: {
    __isTypeOf: __isTypeOf(Kind.ENUM_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    values: t =>
      t.entity.values.map(v => ({
        entity: v,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? { ownedByServiceNames: t.supergraph.getEnumValueOwnedByServices(v.name) }
          : null,
      })),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInputObjectType: {
    __isTypeOf: __isTypeOf(Kind.INPUT_OBJECT_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      t.entity.fields.map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
        supergraph: t.supergraph
          ? {
              ownedByServiceNames: t.supergraph.getInputFieldOwnedByServices(f.name),
            }
          : null,
      })),
    usage,
    supergraphMetadata: t =>
      t.supergraph
        ? {
            ownedByServiceNames: t.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLScalarType: {
    __isTypeOf: __isTypeOf(Kind.SCALAR_TYPE_DEFINITION),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    usage,
    supergraphMetadata: t =>
      t.supergraph ? { ownedByServiceNames: t.supergraph.ownedByServiceNames } : null,
  },
  GraphQLEnumValue: {
    name: v => v.entity.name,
    description: v => v.entity.description ?? null,
    isDeprecated: v => typeof v.entity.deprecationReason === 'string',
    deprecationReason: v => v.entity.deprecationReason ?? null,
    usage,
    supergraphMetadata: v =>
      v.supergraph ? { ownedByServiceNames: v.supergraph.ownedByServiceNames } : null,
  },
  GraphQLUnionTypeMember: {
    name: m => m.entity.name,
    usage,
    supergraphMetadata: m =>
      m.supergraph ? { ownedByServiceNames: m.supergraph.ownedByServiceNames } : null,
  },
  GraphQLField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    type: f => f.entity.type,
    args: f =>
      f.entity.args.map(a => ({
        entity: a,
        parent: {
          coordinate: `${f.parent.coordinate}.${f.entity.name}`,
        },
        usage: f.usage,
      })),
    usage,
    supergraphMetadata: f =>
      f.supergraph
        ? {
            ownedByServiceNames: f.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLInputField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    type: f => f.entity.type,
    defaultValue: f => stringifyDefaultValue(f.entity.defaultValue),
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    usage,
    supergraphMetadata: f =>
      f.supergraph
        ? {
            ownedByServiceNames: f.supergraph.ownedByServiceNames,
          }
        : null,
  },
  GraphQLArgument: {
    name: a => a.entity.name,
    description: a => a.entity.description ?? null,
    type: a => a.entity.type,
    defaultValue: a => stringifyDefaultValue(a.entity.defaultValue),
    deprecationReason: a => a.entity.deprecationReason ?? null,
    isDeprecated: a => typeof a.entity.deprecationReason === 'string',
    usage,
  },
  SuccessfulSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges() {
      return false;
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    isApproved(schemaCheck) {
      return schemaCheck.isManuallyApproved;
    },
    approvedBy(schemaCheck, _, { injector }) {
      return schemaCheck.isManuallyApproved
        ? injector.get(SchemaManager).getApprovedByUser({
            organizationId: schemaCheck.selector.organizationId,
            userId: schemaCheck.manualApprovalUserId,
          })
        : null;
    },
    approvalComment(schemaCheck) {
      return schemaCheck.isManuallyApproved ? schemaCheck.manualApprovalComment : null;
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  FailedSchemaCheck: {
    schemaVersion(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSchemaVersion(schemaCheck);
    },
    safeSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getSafeSchemaChanges(schemaCheck);
    },
    breakingSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getBreakingSchemaChanges(schemaCheck);
    },
    compositionErrors(schemaCheck) {
      return schemaCheck.schemaCompositionErrors;
    },
    hasSchemaCompositionErrors(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaCompositionErrors(schemaCheck);
    },
    hasSchemaChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasSchemaChanges(schemaCheck);
    },
    hasUnapprovedBreakingChanges(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getHasUnapprovedBreakingChanges(schemaCheck);
    },
    webUrl(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getSchemaCheckWebUrl({
        schemaCheckId: schemaCheck.id,
        targetId: schemaCheck.targetId,
      });
    },
    async canBeApproved(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApproved(schemaCheck);
    },
    async canBeApprovedByViewer(schemaCheck, _, { injector }) {
      return injector.get(SchemaManager).getFailedSchemaCheckCanBeApprovedByViewer(schemaCheck);
    },
    contractChecks(schemaCheck, _, { injector }) {
      return injector.get(ContractsManager).getContractsChecksForSchemaCheck(schemaCheck);
    },
    previousSchemaSDL(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getPreviousSchemaSDL(schemaCheck);
    },
    conditionalBreakingChangeMetadata(schemaCheck, _, { injector }) {
      return injector.get(SchemaCheckManager).getConditionalBreakingChangeMetadata(schemaCheck);
    },
  },
  BreakingChangeMetadataTarget: {
    target(record, _, { injector }) {
      return injector
        .get(TargetManager)
        .getTargetById({ targetId: record.id })
        .catch(() => null);
    },
  },
  SchemaPolicyWarningConnection: createDummyConnection(warning => ({
    ...warning,
    start: {
      column: warning.column,
      line: warning.line,
    },
    end:
      warning.endColumn && warning.endLine
        ? {
            column: warning.endColumn,
            line: warning.endLine,
          }
        : null,
  })),
  Contract: {
    target(contract, _, context) {
      return context.injector.get(TargetManager).getTargetById({
        targetId: contract.targetId,
      });
    },
    viewerCanDisableContract(contract, _, context) {
      return context.injector
        .get(ContractsManager)
        .getViewerCanDisableContractForContract(contract);
    },
  },
  ContractCheck: {
    contractVersion(contractCheck, _, context) {
      return context.injector
        .get(ContractsManager)
        .getContractVersionForContractCheck(contractCheck);
    },
    compositeSchemaSDL: contractCheck => contractCheck.compositeSchemaSdl,
    supergraphSDL: contractCheck => contractCheck.supergraphSdl,
    hasSchemaCompositionErrors(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasSchemaCompositionErrorsForContractCheck(contractCheck);
    },
    hasUnapprovedBreakingChanges(contractCheck, _, { injector }) {
      return injector
        .get(ContractsManager)
        .getHasUnapprovedBreakingChangesForContractCheck(contractCheck);
    },
    hasSchemaChanges(contractCheck, _, { injector }) {
      return injector.get(ContractsManager).getHasSchemaChangesForContractCheck(contractCheck);
    },
  },
  ContractVersion: {
    isComposable(contractVersion) {
      return contractVersion.schemaCompositionErrors === null;
    },
    hasSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getHasSchemaChangesForContractVersion(contractVersion);
    },
    breakingSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getBreakingChangesForContractVersion(contractVersion);
    },
    safeSchemaChanges(contractVersion, _, context) {
      return context.injector
        .get(ContractsManager)
        .getSafeChangesForContractVersion(contractVersion);
    },
    compositeSchemaSDL: contractVersion => contractVersion.compositeSchemaSdl,
    supergraphSDL: contractVersion => contractVersion.supergraphSdl,
    previousContractVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getPreviousContractVersionForContractVersion(contractVersion),
    previousDiffableContractVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getDiffableContractVersionForContractVersion(contractVersion),
    isFirstComposableVersion: (contractVersion, _, context) =>
      context.injector
        .get(ContractsManager)
        .getIsFirstComposableVersionForContractVersion(contractVersion),
  },
};

function stringifyDefaultValue(value: unknown): string | null {
  if (typeof value !== 'undefined') {
    return stringify(value);
  }
  return null;
}

function withUsedByClients<
  T extends {
    isUsed: boolean;
  },
>(
  input: Record<string, T>,
  deps: {
    operationsManager: OperationsManager;
    selector: TargetSelector;
    period: DateRange;
    typename: string;
  },
): Record<
  string,
  T & {
    usedByClients: () => PromiseOrValue<Array<string>>;
    period: DateRange;
    organization: string;
    project: string;
    target: string;
    typename: string;
  }
> {
  return Object.fromEntries(
    Object.entries(input).map(([schemaCoordinate, record]) => [
      schemaCoordinate,
      {
        selector: deps.selector,
        period: deps.period,
        typename: deps.typename,
        organization: deps.selector.organization,
        project: deps.selector.project,
        target: deps.selector.target,
        ...record,
        usedByClients() {
          if (record.isUsed === false) {
            return [];
          }

          // It's using DataLoader under the hood so it's safe to call it multiple times for different coordinates
          return deps.operationsManager.getClientNamesPerCoordinateOfType({
            ...deps.selector,
            period: deps.period,
            typename: deps.typename,
            schemaCoordinate,
          });
        },
      },
    ]),
  );
}

function transformGraphQLObjectType(entity: GraphQLObjectType): GraphQLObjectTypeMapper['entity'] {
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    interfaces: entity.getInterfaces().map(iface => iface.name),
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      type: field.type.toString(),
      args: field.args.map(arg => ({
        name: arg.name,
        description: arg.description,
        defaultValue: arg.defaultValue,
        type: arg.type.toString(),
        deprecationReason: arg.deprecationReason,
      })),
    })),
  };
}

function transformGraphQLInterfaceType(
  entity: GraphQLInterfaceType,
): GraphQLInterfaceTypeMapper['entity'] {
  return {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    interfaces: entity.getInterfaces().map(iface => iface.name),
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      type: field.type.toString(),
      args: field.args.map(arg => ({
        name: arg.name,
        description: arg.description,
        defaultValue: arg.defaultValue,
        type: arg.type.toString(),
        deprecationReason: arg.deprecationReason,
      })),
    })),
  };
}

function transformGraphQLEnumType(entity: GraphQLEnumType): GraphQLEnumTypeMapper['entity'] {
  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    values: entity.getValues().map(value => ({
      name: value.name,
      description: value.description,
      deprecationReason: value.deprecationReason,
    })),
  };
}

function transformGraphQLUnionType(entity: GraphQLUnionType): GraphQLUnionTypeMapper['entity'] {
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    members: entity.getTypes().map(type => ({
      name: type.name,
    })),
  };
}

function transformGraphQLInputObjectType(
  entity: GraphQLInputObjectType,
): GraphQLInputObjectTypeMapper['entity'] {
  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
    fields: Object.values(entity.getFields()).map(field => ({
      name: field.name,
      description: field.description,
      deprecationReason: field.deprecationReason,
      defaultValue: field.defaultValue,
      type: field.type.toString(),
    })),
  };
}

function transformGraphQLScalarType(entity: GraphQLScalarType): GraphQLScalarTypeMapper['entity'] {
  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    name: entity.name,
    description: entity.description,
  };
}

const criticalityMap: Record<CriticalityLevel, Types.CriticalityLevel> = {
  [CriticalityLevel.Breaking]: 'Breaking',
  [CriticalityLevel.NonBreaking]: 'Safe',
  [CriticalityLevel.Dangerous]: 'Dangerous',
};

function deprecationReasonFromDirectives(directives: readonly ConstDirectiveNode[] | undefined) {
  if (!directives) {
    return null;
  }

  const deprecatedDirective = directives.find(d => d.name.value === 'deprecated');

  if (!deprecatedDirective) {
    return null;
  }

  const reasonArgument = deprecatedDirective.arguments?.find(a => a.name.value === 'reason');

  if (!reasonArgument) {
    return DEFAULT_DEPRECATION_REASON;
  }

  if (reasonArgument.value.kind !== 'StringValue') {
    throw new Error('Expected @deprecated(reason:) to be StringValue');
  }

  return reasonArgument.value.value;
}

function buildGraphQLTypesFromSDL(
  sdl: DocumentNode,
  getStats: (
    typeName: string,
  ) => ReturnType<
    | GraphQLObjectTypeMapper['usage']
    | GraphQLInterfaceTypeMapper['usage']
    | GraphQLUnionTypeMapper['usage']
    | GraphQLEnumTypeMapper['usage']
    | GraphQLInputObjectTypeMapper['usage']
    | GraphQLScalarTypeMapper['usage']
  >,
  supergraph: SuperGraphInformation | null,
) {
  const types: Array<
    | GraphQLObjectTypeMapper
    | GraphQLInterfaceTypeMapper
    | GraphQLUnionTypeMapper
    | GraphQLEnumTypeMapper
    | GraphQLInputObjectTypeMapper
    | GraphQLScalarTypeMapper
  > = [];

  for (const typeDefinition of sdl.definitions) {
    if (typeDefinition.kind === Kind.OBJECT_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.OBJECT_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          interfaces: typeDefinition.interfaces?.map(i => i.name.value) ?? [],
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              description: f.description?.value,
              type: print(f.type),
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              args:
                f.arguments?.map(a => ({
                  name: a.name.value,
                  description: a.description?.value,
                  deprecationReason: deprecationReasonFromDirectives(a.directives),
                  type: print(a.type),
                })) ?? [],
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLObjectTypeMapper);
    } else if (typeDefinition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.INTERFACE_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          interfaces: typeDefinition.interfaces?.map(i => i.name.value) ?? [],
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              description: f.description?.value,
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              type: print(f.type),
              args:
                f.arguments?.map(a => ({
                  name: a.name.value,
                  description: a.description?.value,
                  deprecationReason: deprecationReasonFromDirectives(a.directives),
                  type: print(a.type),
                })) ?? [],
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getFieldOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLInterfaceTypeMapper);
    } else if (typeDefinition.kind === Kind.ENUM_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.ENUM_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          values:
            typeDefinition.values?.map(value => ({
              name: value.name.value,
              description: value.description?.value,
              deprecationReason: deprecationReasonFromDirectives(value.directives),
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getEnumValueOwnedByServices: (fieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${fieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLEnumTypeMapper);
    } else if (typeDefinition.kind === Kind.UNION_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.UNION_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          members:
            typeDefinition.types?.map(t => ({
              name: t.name.value,
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getUnionMemberOwnedByServices: (memberName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(memberName) ?? null,
            }
          : null,
      } satisfies GraphQLUnionTypeMapper);
    } else if (typeDefinition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
          fields:
            typeDefinition.fields?.map(f => ({
              name: f.name.value,
              defaultValue: f.defaultValue ? print(f.defaultValue) : undefined,
              description: f.description?.value,
              deprecationReason: deprecationReasonFromDirectives(f.directives),
              type: print(f.type),
            })) ?? [],
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
              getInputFieldOwnedByServices: (inputFieldName: string) =>
                supergraph.schemaCoordinateServicesMappings.get(
                  `${typeDefinition.name.value}.${inputFieldName}`,
                ) ?? null,
            }
          : null,
      } satisfies GraphQLInputObjectTypeMapper);
    } else if (typeDefinition.kind === Kind.SCALAR_TYPE_DEFINITION) {
      types.push({
        entity: {
          kind: Kind.SCALAR_TYPE_DEFINITION,
          name: typeDefinition.name.value,
          description: typeDefinition.description?.value,
        },
        usage() {
          return getStats(typeDefinition.name.value);
        },
        supergraph: supergraph
          ? {
              ownedByServiceNames:
                supergraph.schemaCoordinateServicesMappings.get(typeDefinition.name.value) ?? null,
            }
          : null,
      } satisfies GraphQLScalarTypeMapper);
    }
  }

  return types;
}
