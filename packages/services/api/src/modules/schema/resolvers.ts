import { createHash } from 'crypto';
import {
  buildASTSchema,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isScalarType,
  GraphQLNamedType,
  GraphQLError,
} from 'graphql';
import type { SchemaModule } from './__generated__/types';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { Inspector } from './providers/inspector';
import { buildSchema, createConnection } from '../../shared/schema';
import { ProjectType } from '../../shared/entities';
import type {
  GraphQLObjectTypeMapper,
  GraphQLInterfaceTypeMapper,
  GraphQLUnionTypeMapper,
  GraphQLEnumTypeMapper,
  GraphQLInputObjectTypeMapper,
  GraphQLScalarTypeMapper,
} from '../../shared/mappers';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { SchemaBuildError } from './providers/orchestrators/errors';
import { TargetManager } from '../target/providers/target-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { z } from 'zod';
import { SchemaHelper } from './providers/schema-helper';
import type { WithSchemaCoordinatesUsage, WithGraphQLParentInfo } from '../../shared/mappers';
import { createPeriod, parseDateRangeInput } from '../../shared/helpers';
import { OperationsManager } from '../operations/providers/operations-manager';

const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);
const GraphQLSchemaStringModel = z.string().max(5_000_000).min(0);
const ServiceNameModel = z.string().min(1).max(100);

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
        organization,
        project,
        target,
      });
    },
    async schemaPublish(_, { input }, { injector }, info) {
      const [organization, project, target] = await Promise.all([
        injector.get(OrganizationManager).getOrganizationIdByToken(),
        injector.get(ProjectManager).getProjectIdByToken(),
        injector.get(TargetManager).getTargetIdByToken(),
      ]);
      const token = injector.get(AuthManager).ensureApiToken();

      const checksum = createHash('md5')
        .update(JSON.stringify(input))
        .update(token)
        .digest('base64');

      // We only want to resolve to SchemaPublishMissingUrlError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingUrlError' is becomes pretty low.
      const parsedResolveInfoFragment = parseResolveInfo(info);
      const isSchemaPublishMissingUrlErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingUrlError'];

      return injector.get(SchemaPublisher).publish({
        ...input,
        checksum,
        organization,
        project,
        target,
        isSchemaPublishMissingUrlErrorSelected,
      });
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
    async updateSchemaServiceName(_, { input }, { injector }) {
      const UpdateSchemaServiceNameModel = z.object({
        newName: ServiceNameModel,
      });

      const result = UpdateSchemaServiceNameModel.safeParse(input);

      if (!result.success) {
        return {
          error: {
            message: result.error.formErrors.fieldErrors.newName?.[0] ?? 'Please check your input.',
          },
        };
      }

      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      const { type: projectType } = await injector.get(ProjectManager).getProject({
        organization,
        project,
      });

      await injector.get(SchemaManager).updateServiceName({
        organization,
        project,
        target,
        version: input.version,
        name: input.name,
        newName: input.newName,
        projectType,
      });

      return {
        ok: {
          updatedTarget: await injector.get(TargetManager).getTarget({
            organization,
            project,
            target,
          }),
        },
      };
    },
    async schemaSyncCDN(_, { input }, { injector }) {
      const translator = injector.get(IdTranslator);
      const [organization, project, target] = await Promise.all([
        translator.translateOrganizationId(input),
        translator.translateProjectId(input),
        translator.translateTargetId(input),
      ]);

      try {
        await injector.get(SchemaPublisher).sync({
          organization,
          project,
          target,
        });

        return {
          __typename: 'SchemaSyncCDNSuccess',
          message: 'CDN is now up to date with the latest version',
        };
      } catch (error) {
        return {
          __typename: 'SchemaSyncCDNError',
          message: error instanceof Error ? error.message : 'Failed to sync with CDN',
        };
      }
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
  },
  Query: {
    async schemaCompare(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const schemaManager = injector.get(SchemaManager);
      const projectManager = injector.get(ProjectManager);
      const helper = injector.get(SchemaHelper);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const project = await projectManager.getProject({
        organization: organizationId,
        project: projectId,
      });
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      // TODO: collect stats from a period between these two versions
      const [schemasBefore, schemasAfter] = await Promise.all([
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.before,
        }),
        injector.get(SchemaManager).getSchemasOfVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.after,
        }),
      ]);

      return Promise.all([
        orchestrator.build(
          schemasBefore.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        ),
        orchestrator.build(
          schemasAfter.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        ),
      ]).catch(reason => {
        if (reason instanceof SchemaBuildError) {
          return Promise.resolve({
            message: reason.message,
          });
        }

        return Promise.reject(reason);
      });
    },
    async schemaCompareToPrevious(_, { selector }, { injector }) {
      const translator = injector.get(IdTranslator);
      const schemaManager = injector.get(SchemaManager);
      const projectManager = injector.get(ProjectManager);
      const helper = injector.get(SchemaHelper);

      const [organizationId, projectId, targetId] = await Promise.all([
        translator.translateOrganizationId(selector),
        translator.translateProjectId(selector),
        translator.translateTargetId(selector),
      ]);

      const project = await projectManager.getProject({
        organization: organizationId,
        project: projectId,
      });
      const orchestrator = schemaManager.matchOrchestrator(project.type);

      // TODO: collect stats from a period between these two versions
      const [schemasBefore, schemasAfter] = await Promise.all([
        injector.get(SchemaManager).getSchemasOfPreviousVersion({
          organization: organizationId,
          project: projectId,
          target: targetId,
          version: selector.version,
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
          ? orchestrator.build(
              schemasBefore.map(s => helper.createSchemaObject(s)),
              project.externalComposition,
            )
          : null,
        orchestrator.build(
          schemasAfter.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        ),
      ]).catch(reason => {
        if (reason instanceof SchemaBuildError) {
          return Promise.resolve({
            message: reason.message,
          });
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

      return injector.get(SchemaManager).getLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
    },
    async latestValidVersion(_, __, { injector }) {
      const target = await injector.get(TargetManager).getTargetFromToken();

      return injector.get(SchemaManager).getLatestValidVersion({
        organization: target.orgId,
        project: target.projectId,
        target: target.id,
      });
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
    commit(version, _, { injector }) {
      return injector.get(SchemaManager).getCommit({
        commit: version.commit,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });
    },
    schemas(version, _, { injector }) {
      return injector.get(SchemaManager).getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });
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

      const schemas = await schemaManager.getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      return orchestrator.supergraph(
        schemas.map(s => helper.createSchemaObject(s)),
        project.externalComposition,
      );
    },
    async sdl(version, _, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const helper = injector.get(SchemaHelper);

      const schemas = await schemaManager.getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      return (
        await orchestrator.build(
          schemas.map(s => helper.createSchemaObject(s)),
          project.externalComposition,
        )
      ).raw;
    },
    async baseSchema(version) {
      return version.base_schema || null;
    },
    async explorer(version, { usage }, { injector }) {
      const project = await injector.get(ProjectManager).getProject({
        organization: version.organization,
        project: version.project,
      });

      const schemaManager = injector.get(SchemaManager);
      const orchestrator = schemaManager.matchOrchestrator(project.type);
      const helper = injector.get(SchemaHelper);

      const schemas = await schemaManager.getCommits({
        version: version.id,
        organization: version.organization,
        project: version.project,
        target: version.target,
      });

      const schema = await orchestrator.build(
        schemas.map(s => helper.createSchemaObject(s)),
        project.externalComposition,
      );

      return {
        schema: buildASTSchema(schema.document, {
          assumeValidSDL: true,
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
    __isTypeOf(error) {
      return 'message' in error;
    },
  },
  SchemaCompareResult: {
    __isTypeOf(obj) {
      return Array.isArray(obj);
    },
    initial([before]) {
      return !before;
    },
    changes([before, after], _, { injector }) {
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

      return injector.get(Inspector).diff(previousSchema, currentSchema);
    },
    diff([before, after]) {
      return {
        before: before ? before.raw : '',
        after: after.raw,
      };
    },
  },
  SchemaConnection: createConnection(),
  SchemaVersionConnection: {
    pageInfo(info) {
      return {
        hasMore: info.hasMore,
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
