import { createHash } from 'crypto';
import {
  buildASTSchema,
  GraphQLError,
  GraphQLNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { z } from 'zod';
import type { CriticalityLevel } from '../../__generated__/types';
import { ProjectType, Schema } from '../../shared/entities';
import { createPeriod, parseDateRangeInput } from '../../shared/helpers';
import type {
  GraphQLEnumTypeMapper,
  GraphQLInputObjectTypeMapper,
  GraphQLInterfaceTypeMapper,
  GraphQLObjectTypeMapper,
  GraphQLScalarTypeMapper,
  GraphQLUnionTypeMapper,
  SchemaCompareError,
  SchemaCompareResult,
} from '../../shared/mappers';
import type { WithGraphQLParentInfo, WithSchemaCoordinatesUsage } from '../../shared/mappers';
import { buildSchema, createConnection } from '../../shared/schema';
import { AuthManager } from '../auth/providers/auth-manager';
import { OperationsManager } from '../operations/providers/operations-manager';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { TargetManager } from '../target/providers/target-manager';
import type { SchemaModule } from './__generated__/types';
import { Inspector, toGraphQLSchemaChange } from './providers/inspector';
import { SchemaBuildError } from './providers/orchestrators/errors';
import { ensureSDL, isCompositeSchema, SchemaHelper } from './providers/schema-helper';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { schemaChangeFromMeta } from './schema-change-from-meta';

const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);
const GraphQLSchemaStringModel = z.string().max(5_000_000).min(0);

async function usage(
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
) {
  const coordinate =
    'parent' in source ? `${source.parent.coordinate}.${source.entity.name}` : source.entity.name;
  const usage = (await source.usage)[coordinate];

  return usage
    ? {
        total: usage.total,
        isUsed: usage.total > 0,
      }
    : {
        total: 0,
        isUsed: false,
      };
}

function __isTypeOf<T extends GraphQLNamedType>(isFn: (entity: GraphQLNamedType) => entity is T) {
  return ({ entity }: { entity: GraphQLNamedType }) => isFn(entity);
}

export const resolvers: SchemaModule.Resolvers = {
  Mutation: {
    async schemaCheck(_, { input }, { injector }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      return injector.get(SchemaPublisher).check({
        ...input,
        service: input.service?.toLowerCase(),
        organization,
        project,
        target,
      });
    },
    async schemaPublish(_, { input }, { injector, abortSignal }, info) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);
      const token = injector.get(AuthManager).ensureApiToken();

      const checksum = createHash('md5')
        .update(
          JSON.stringify({
            ...input,
            organization,
            project,
            target,
            service: input.service?.toLowerCase(),
          }),
        )
        .update(token)
        .digest('base64');

      // We only want to resolve to SchemaPublishMissingUrlError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingUrlError' is becomes pretty low.
      const parsedResolveInfoFragment = parseResolveInfo(info);
      const isSchemaPublishMissingUrlErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingUrlError'];

      return injector.get(SchemaPublisher).publish(
        {
          ...input,
          service: input.service?.toLowerCase(),
          checksum,
          organization,
          project,
          target,
          isSchemaPublishMissingUrlErrorSelected,
        },
        abortSignal,
      );
    },
    async schemaDelete(_, { input }, { injector, abortSignal }) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);

      const token = injector.get(AuthManager).ensureApiToken();

      const checksum = createHash('md5')
        .update(
          JSON.stringify({
            ...input,
            serviceName: input.serviceName.toLowerCase(),
          }),
        )
        .update(token)
        .digest('base64');

      return injector.get(SchemaPublisher).delete(
        {
          dryRun: input.dryRun,
          serviceName: input.serviceName.toLowerCase(),
          organization,
          project,
          target,
          checksum,
        },
        abortSignal,
      );
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

      return injector.get(SchemaManager).disableExternalSchemaComposition({
        project,
        organization,
      });
    },
    async enableExternalSchemaComposition(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return injector.get(SchemaManager).enableExternalSchemaComposition({
        project,
        organization,
        endpoint: input.endpoint,
        secret: input.secret,
      });
    },
    async updateProjectRegistryModel(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
      ]);

      return injector.get(SchemaManager).updateRegistryModel({
        project,
        organization,
        model: input.model,
      });
    },
  },
  Query: {
    async schemaCompareToPrevious(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const schemaManager = injector.get(SchemaManager);
      const projectManager = injector.get(ProjectManager);
      const organizationManager = injector.get(OrganizationManager);
      const helper = injector.get(SchemaHelper);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const [project, organization] = await Promise.all([
        projectManager.getProject({
          organization: organizationId,
          project: projectId,
        }),
        organizationManager.getOrganization({
          organization: organizationId,
        }),
      ]);
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      const [schemasBefore, schemasAfter] = await Promise.all([
        injector.get(SchemaManager).getSchemasOfPreviousVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.version,
          onlyComposable: organization.featureFlags.compareToPreviousComposableVersion === true,
        }),
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.version,
        }),
      ]);

      return Promise.all([
        schemasBefore.length
          ? ensureSDL(
              orchestrator.composeAndValidate(
                schemasBefore.map(s => helper.createSchemaObject(s)),
                project.externalComposition,
              ),
            )
          : null,
        ensureSDL(
          orchestrator.composeAndValidate(
            schemasAfter.map(s => helper.createSchemaObject(s)),
            project.externalComposition,
          ),
          organization.featureFlags.compareToPreviousComposableVersion === true
            ? // Do not show schema changes if the new version is not composable
              // It only applies when the feature flag is enabled.
              // Otherwise, we show the errors as usual.
              'reject-on-graphql-errors'
            : 'ignore-errors',
        ),
      ])
        .then(([before, after]) => {
          const result: SchemaCompareResult = {
            result: {
              schemas: [before, after],
              versionSelector: {
                organization: organizationId,
                project: projectId,
                target: targetId,
                version: selector.version,
              },
              serviceUrlChanges: detectUrlChanges(schemasBefore, schemasAfter).map(change => {
                return {
                  message: change.serviceUrl.after
                    ? `[${change.serviceName}] New service url: '${
                        change.serviceUrl.after
                      }' (previously: '${change.serviceUrl.before ?? 'none'}')`
                    : `[${change.serviceName}] Service url removed (previously: '${
                        change.serviceUrl.before ?? 'none'
                      }'`,
                  criticality: 'Dangerous' satisfies CriticalityLevel,
                } as const;
              }),
            },
          };

          return result;
        })

        .catch(reason => {
          if (reason instanceof SchemaBuildError) {
            const result: SchemaCompareError = {
              error: {
                message: reason.message,
              },
            };
            return Promise.resolve(result);
          }

          return Promise.reject(reason);
        });
    },
    async schemaVersions(_, { selector, after, limit }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(SchemaManager).getSchemaVersions({
        organization,
        project,
        target,
        after,
        limit,
      });
    },
    async schemaVersion(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      return injector.get(SchemaManager).getSchemaVersion({
        organization,
        project,
        target,
        version: selector.version,
      });
    },
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
  },
  Target: {
    latestSchemaVersion(target, _, { injector }) {
      return injector.get(SchemaManager).getMaybeLatestVersion({
        target: target.id,
        project: target.projectId,
        organization: target.orgId,
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
  },
  SchemaVersion: {
    async log(version, _, { injector }) {
      const log = await injector.get(SchemaManager).getSchemaLog({
        commit: version.commit,
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
        };
      }

      return {
        __typename: 'PushedSchemaLog',
        author: log.author,
        commit: log.commit,
        date: log.date as any,
        id: log.id,
        service: log.service_name,
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
    async errors(version, _, { injector }) {
      const schemaManager = injector.get(SchemaManager);
      const schemaHelper = injector.get(SchemaHelper);
      const [schemas, project] = await Promise.all([
        schemaManager.getMaybeSchemasOfVersion({
          version: version.id,
          organization: version.organization,
          project: version.project,
          target: version.target,
        }),
        injector.get(ProjectManager).getProject({
          organization: version.organization,
          project: version.project,
        }),
      ]);

      if (schemas.length === 0) {
        return [];
      }

      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const validation = await orchestrator.composeAndValidate(
        schemas.map(s => schemaHelper.createSchemaObject(s)),
        project.externalComposition,
      );

      return validation.errors;
    },
    async supergraph(version, _, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      if (project.type !== ProjectType.FEDERATION) {
        return null;
      }

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const helper = injector.get(SchemaHelper);

      const schemas = await schemaManager.getMaybeSchemasOfVersion({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
        includeMetadata: false,
      });

      if (schemas.length === 0) {
        return null;
      }

      return orchestrator
        .composeAndValidate(
          schemas.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        )
        .then(r => r.supergraph);
    },
    async sdl(version, _, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const helper = injector.get(SchemaHelper);

      const schemas = await schemaManager.getMaybeSchemasOfVersion({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
        includeMetadata: false,
      });

      if (schemas.length === 0) {
        return null;
      }

      return (
        await ensureSDL(
          orchestrator.composeAndValidate(
            schemas.map(s => helper.createSchemaObject(s)),
            project.externalComposition,
          ),
        )
      ).raw;
    },
    async baseSchema(version) {
      return version.baseSchema || null;
    },
    async explorer(version, { usage }, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const helper = injector.get(SchemaHelper);

      const schemas = await schemaManager.getSchemasOfVersion({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      const schema = await ensureSDL(
        orchestrator.composeAndValidate(
          schemas.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        ),
      );

      return {
        schema: buildASTSchema(schema.document, {
          assumeValidSDL: true,
          assumeValid: true,
        }),
        usage: {
          period: usage?.period ? parseDateRangeInput(usage.period) : createPeriod('30d'),
          organization: version.organization,
          project: version.project,
          target: version.target,
        },
      };
    },
  },
  SchemaCompareError: {
    __isTypeOf(source: unknown) {
      return typeof source === 'object' && source != null && 'error' in source;
    },
  },
  SchemaCompareResult: {
    __isTypeOf(source: unknown) {
      return typeof source === 'object' && source != null && 'result' in source;
    },
    initial(source) {
      return !!source.result.schemas[0];
    },
    async changes(source, _, { injector }) {
      const schemaVersion = await injector
        .get(SchemaManager)
        .getSchemaVersion(source.result.versionSelector);

      if (schemaVersion.hasPersistedSchemaChanges === true) {
        const changes = await injector
          .get(SchemaManager)
          .getSchemaChangesForVersion(source.result.versionSelector);

        if (Array.isArray(changes)) {
          return changes.map(change => toGraphQLSchemaChange(schemaChangeFromMeta(change)));
        }
      }

      // LEGACY LAND
      // If we don't have the stuff in the database we compute it on demand.

      const [before, after] = source.result.schemas;

      if (!before) {
        return [];
      }

      const previousSchema = buildSchema(
        before,
        error =>
          new GraphQLError(
            `Failed to build the previous version: ${
              error instanceof GraphQLError ? error.message : error
            }`,
          ),
      );
      const currentSchema = buildSchema(
        after,
        error =>
          new GraphQLError(
            `Failed to build the selected version: ${
              error instanceof GraphQLError ? error.message : error
            }`,
          ),
      );

      const schemaChanges = await injector.get(Inspector).diff(previousSchema, currentSchema);

      return schemaChanges.map(toGraphQLSchemaChange).concat(source.result.serviceUrlChanges);
    },
    diff(source) {
      const [before, after] = source.result.schemas;

      return {
        before: before ? before.raw : '',
        after: after.raw,
      };
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
  SchemaVersionConnection: {
    pageInfo(info) {
      return {
        hasNextPage: info.hasMore,
        hasPreviousPage: false,
        endCursor: '',
        startCursor: '',
      };
    },
  },
  SchemaChangeConnection: createConnection(),
  SchemaErrorConnection: createConnection(),
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
  },
  SchemaExplorer: {
    async type({ schema, usage }, { name }, { injector }) {
      const namedType = schema.getType(name);

      if (!namedType) {
        return null;
      }

      return {
        // TODO: fix any
        entity: namedType as any,
        usage: injector.get(OperationsManager).countCoordinatesOfType({
          typename: namedType.name,
          organization: usage.organization,
          project: usage.project,
          target: usage.target,
          period: usage.period,
        }),
      };
    },
    async types({ schema, usage }, _, { injector }) {
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

      function getStats() {
        return operationsManager.countCoordinatesOfTarget({
          target: usage.target,
          organization: usage.organization,
          project: usage.project,
          period: usage.period,
        });
      }

      for (const typename in typeMap) {
        if (typename.startsWith('__')) {
          continue;
        }

        types.push({
          entity: typeMap[typename] as any,
          get usage() {
            return getStats();
          },
        });
      }

      types.sort((a, b) => a.entity.name.localeCompare(b.entity.name));

      return types;
    },
    async query({ schema, usage }, _, { injector }) {
      const queryType = schema.getQueryType();

      if (!queryType) {
        return null;
      }

      return {
        entity: queryType,
        get usage() {
          return injector.get(OperationsManager).countCoordinatesOfType({
            typename: queryType.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          });
        },
      };
    },
    async mutation({ schema, usage }, _, { injector }) {
      const mutationType = schema.getMutationType();

      if (!mutationType) {
        return null;
      }

      return {
        entity: mutationType,
        get usage() {
          return injector.get(OperationsManager).countCoordinatesOfType({
            typename: mutationType.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          });
        },
      };
    },
    async subscription({ schema, usage }, _, { injector }) {
      const subscriptionType = schema.getSubscriptionType();

      if (!subscriptionType) {
        return null;
      }

      return {
        entity: subscriptionType,
        get usage() {
          return injector.get(OperationsManager).countCoordinatesOfType({
            typename: subscriptionType.name,
            organization: usage.organization,
            project: usage.project,
            target: usage.target,
            period: usage.period,
          });
        },
      };
    },
  },
  GraphQLObjectType: {
    __isTypeOf: __isTypeOf(isObjectType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      Object.values(t.entity.getFields()).map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
      })),
    interfaces: t => t.entity.getInterfaces().map(i => i.name),
    usage,
  },
  GraphQLInterfaceType: {
    __isTypeOf: __isTypeOf(isInterfaceType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      Object.values(t.entity.getFields()).map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
      })),
    interfaces: t => t.entity.getInterfaces().map(i => i.name),
    usage,
  },
  GraphQLUnionType: {
    __isTypeOf: __isTypeOf(isUnionType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    members: t =>
      t.entity.getTypes().map(i => {
        return {
          entity: i,
          usage: t.usage,
          parent: {
            coordinate: t.entity.name,
          },
        };
      }),
    usage,
  },
  GraphQLEnumType: {
    __isTypeOf: __isTypeOf(isEnumType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    values: t =>
      t.entity.getValues().map(v => ({
        entity: v,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
      })),
    usage,
  },
  GraphQLInputObjectType: {
    __isTypeOf: __isTypeOf(isInputObjectType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    fields: t =>
      Object.values(t.entity.getFields()).map(f => ({
        entity: f,
        parent: {
          coordinate: t.entity.name,
        },
        usage: t.usage,
      })),
    usage,
  },
  GraphQLScalarType: {
    __isTypeOf: __isTypeOf(isScalarType),
    name: t => t.entity.name,
    description: t => t.entity.description ?? null,
    usage,
  },
  GraphQLEnumValue: {
    name: v => v.entity.name,
    description: v => v.entity.description ?? null,
    isDeprecated: v => typeof v.entity.deprecationReason === 'string',
    deprecationReason: v => v.entity.deprecationReason ?? null,
    usage,
  },
  GraphQLUnionTypeMember: {
    name: m => m.entity.name,
    usage,
  },
  GraphQLField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    type: f => f.entity.type.toString(),
    args: f =>
      f.entity.args.map(a => ({
        entity: a,
        parent: {
          coordinate: `${f.parent.coordinate}.${f.entity.name}`,
        },
        usage: f.usage,
      })),
    usage,
  },
  GraphQLInputField: {
    name: f => f.entity.name,
    description: f => f.entity.description ?? null,
    type: f => f.entity.type.toString(),
    defaultValue: f => stringifyDefaultValue(f.entity.defaultValue),
    isDeprecated: f => typeof f.entity.deprecationReason === 'string',
    deprecationReason: f => f.entity.deprecationReason ?? null,
    usage,
  },
  GraphQLArgument: {
    name: a => a.entity.name,
    description: a => a.entity.description ?? null,
    type: a => a.entity.type.toString(),
    defaultValue: a => stringifyDefaultValue(a.entity.defaultValue),
    deprecationReason: a => a.entity.deprecationReason ?? null,
    isDeprecated: a => typeof a.entity.deprecationReason === 'string',
    usage,
  },
};

function stringifyDefaultValue(value: unknown): string | null {
  if (typeof value !== 'undefined') {
    return JSON.stringify(value);
  }
  return null;
}

function detectUrlChanges(schemasBefore: readonly Schema[], schemasAfter: readonly Schema[]) {
  if (schemasBefore.length === 0) {
    return [];
  }

  const compositeSchemasBefore = schemasBefore.filter(isCompositeSchema);

  if (compositeSchemasBefore.length === 0) {
    return [];
  }

  const compositeSchemasAfter = schemasAfter.filter(isCompositeSchema);
  const nameToCompositeSchemaMap = new Map(compositeSchemasBefore.map(s => [s.service_name, s]));

  const changes: Array<{
    serviceName: string;
    serviceUrl:
      | {
          before: string;
          after: string;
        }
      | {
          before: null;
          after: string;
        }
      | {
          before: string;
          after: null;
        };
  }> = [];

  for (const schema of compositeSchemasAfter) {
    const before = nameToCompositeSchemaMap.get(schema.service_name);

    if (before && before.service_url !== schema.service_url) {
      changes.push({
        serviceName: schema.service_name,
        serviceUrl: {
          before: before.service_url!, // I used `!` because `before !== after` check means there cannot be `null` for both, but TypeScript knows better...
          after: schema.service_url,
        },
      });
    }
  }

  return changes;
}
