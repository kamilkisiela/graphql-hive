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
} from 'graphql';
import type { SchemaModule } from './__generated__/types';
import { SchemaManager } from './providers/schema-manager';
import { SchemaPublisher } from './providers/schema-publisher';
import { Inspector } from './providers/inspector';
import { buildSchema, createConnection } from '../../shared/schema';
import { ProjectType } from '../../shared/entities';
import { ProjectManager } from '../project/providers/project-manager';
import { IdTranslator } from '../shared/providers/id-translator';
import { OrganizationManager } from '../organization/providers/organization-manager';
import { SchemaBuildError } from './providers/orchestrators/errors';
import { TargetManager } from '../target/providers/target-manager';
import { AuthManager } from '../auth/providers/auth-manager';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import { z } from 'zod';
import { SchemaHelper } from './providers/schema-helper';
import type { WithUsage, WithParent } from '../../shared/mappers';
import { createPeriod, parseDateRangeInput } from '../../shared/helpers';
import { OperationsManager } from '../operations/providers/operations-manager';

const MaybeModel = <T extends z.ZodType>(value: T) => z.union([z.null(), z.undefined(), value]);
const GraphQLSchemaStringModel = z.string().max(5_000_000).min(0);
const ServiceNameModel = z.string().min(1).max(100);

async function usage(
  source:
    | WithUsage<{
        type: {
          name: string;
        };
      }>
    | WithParent<
        WithUsage<{
          name: string;
        }>
      >,
  _: unknown,
  { injector }: GraphQLModules.ModuleContext
) {
  const result = await injector.get(OperationsManager).countCoordinatePerTarget({
    coordinate: 'parent' in source ? `${source.parent.coordinate}.${source.name}` : source.type.name,
    period: source.usage.period,
    organization: source.usage.organization,
    project: source.usage.project,
    target: source.usage.target,
  });

  return result
    ? {
        total: result.total,
        isUsed: result.total > 0,
      }
    : {
        total: 0,
        isUsed: false,
      };
}

function __isTypeOf<T extends GraphQLNamedType>(isFn: (type: GraphQLNamedType) => type is T) {
  return ({ type }: { type: GraphQLNamedType }) => isFn(type);
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

      const checksum = createHash('md5').update(JSON.stringify(input)).update(token).digest('base64');

      const parsedResolveInfoFragment = parseResolveInfo(info);

      // We only want to resolve to SchemaPublishMissingServiceError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingServiceError' is becomes pretty low.
      const isSchemaPublishMissingServiceErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingServiceError'];

      // We only want to resolve to SchemaPublishMissingUrlError if it is selected by the operation.
      // NOTE: This should be removed once the usage of cli versions that don't request on 'SchemaPublishMissingUrlError' is becomes pretty low.
      const isSchemaPublishMissingUrlErrorSelected =
        !!parsedResolveInfoFragment?.fieldsByTypeName['SchemaPublishMissingUrlError'];

      return injector.get(SchemaPublisher).publish({
        ...input,
        checksum,
        organization,
        project,
        target,
        isSchemaPublishMissingServiceErrorSelected,
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
            message: result.error.formErrors.fieldErrors?.newBase?.[0] ?? 'Please check your input.',
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
        orchestrator.build(schemasBefore.map(s => helper.createSchemaObject(s))),
        orchestrator.build(schemasAfter.map(s => helper.createSchemaObject(s))),
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
        schemasBefore.length ? orchestrator.build(schemasBefore.map(s => helper.createSchemaObject(s))) : null,
        orchestrator.build(schemasAfter.map(s => helper.createSchemaObject(s))),
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

      return orchestrator.supergraph(schemas.map(s => helper.createSchemaObject(s)));
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

      return (await orchestrator.build(schemas.map(s => helper.createSchemaObject(s)))).raw;
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

      const schema = await orchestrator.build(schemas.map(s => helper.createSchemaObject(s)));

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

      return injector.get(Inspector).diff(buildSchema(before), buildSchema(after));
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
  SchemaExplorer: {
    type({ schema, usage }, { name }) {
      const namedType = schema.getType(name);

      return namedType
        ? {
            // TODO: fix any
            type: namedType as any,
            usage,
          }
        : null;
    },
    types({ schema, usage }) {
      // TODO: fix any
      const types: Array<{
        type: any;
        usage: typeof usage;
      }> = [];
      const typeMap = schema.getTypeMap();

      for (const typename in typeMap) {
        if (typename.startsWith('__')) {
          continue;
        }

        types.push({
          type: typeMap[typename],
          usage,
        });
      }

      return types;
    },
    query({ schema, usage }) {
      const queryType = schema.getQueryType();

      return queryType
        ? {
            type: queryType,
            usage,
          }
        : null;
    },
    mutation({ schema, usage }) {
      const mutationType = schema.getMutationType();

      return mutationType
        ? {
            type: mutationType,
            usage,
          }
        : null;
    },
    subscription({ schema, usage }) {
      const subscriptionType = schema.getSubscriptionType();

      return subscriptionType
        ? {
            type: subscriptionType,
            usage,
          }
        : null;
    },
  },
  GraphQLObjectType: {
    __isTypeOf: __isTypeOf(isObjectType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    fields: t =>
      Object.values(t.type.getFields()).map(f => ({
        ...f,
        parent: {
          coordinate: t.type.name,
        },
        usage: t.usage,
      })),
    interfaces: t => t.type.getInterfaces().map(i => i.name),
    usage,
  },
  GraphQLInterfaceType: {
    __isTypeOf: __isTypeOf(isInterfaceType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    fields: t =>
      Object.values(t.type.getFields()).map(f => ({
        ...f,
        parent: {
          coordinate: t.type.name,
        },
        usage: t.usage,
      })),
    interfaces: t => t.type.getInterfaces().map(i => i.name),
    usage,
  },
  GraphQLUnionType: {
    __isTypeOf: __isTypeOf(isUnionType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    members: t =>
      t.type.getTypes().map(i => {
        return {
          name: i.name,
          usage: t.usage,
          parent: {
            coordinate: t.type.name,
          },
        };
      }),
    usage,
  },
  GraphQLEnumType: {
    __isTypeOf: __isTypeOf(isEnumType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    values: t =>
      t.type.getValues().map(v => ({
        ...v,
        parent: {
          coordinate: t.type.name,
        },
        usage: t.usage,
      })),
    usage,
  },
  GraphQLInputObjectType: {
    __isTypeOf: __isTypeOf(isInputObjectType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    fields: t =>
      Object.values(t.type.getFields()).map(f => ({
        ...f,
        parent: {
          coordinate: t.type.name,
        },
        usage: t.usage,
      })),
    usage,
  },
  GraphQLScalarType: {
    __isTypeOf: __isTypeOf(isScalarType),
    name: t => t.type.name,
    description: t => t.type.description ?? null,
    usage,
  },
  GraphQLEnumValue: {
    name: v => v.name,
    description: v => v.description ?? null,
    isDeprecated: v => typeof v.deprecationReason === 'string',
    deprecationReason: v => v.deprecationReason ?? null,
    usage,
  },
  GraphQLUnionTypeMember: {
    name: m => m.name,
    usage,
  },
  GraphQLField: {
    name: f => f.name,
    description: f => f.description ?? null,
    isDeprecated: f => typeof f.deprecationReason === 'string',
    deprecationReason: f => f.deprecationReason ?? null,
    type: f => f.type.toString(),
    args: f =>
      f.args.map(a => ({
        ...a,
        parent: {
          coordinate: `${f.parent.coordinate}.${f.name}`,
        },
        usage: f.usage,
      })),
    usage,
  },
  GraphQLInputField: {
    name: f => f.name,
    description: f => f.description ?? null,
    type: f => f.type.toString(),
    defaultValue: f => stringifyDefaultValue(f.defaultValue),
    isDeprecated: f => typeof f.deprecationReason === 'string',
    deprecationReason: f => f.deprecationReason ?? null,
    usage,
  },
  GraphQLArgument: {
    name: a => a.name,
    description: a => a.description ?? null,
    type: a => a.type.toString(),
    defaultValue: a => stringifyDefaultValue(a.defaultValue),
    deprecationReason: a => a.deprecationReason ?? null,
    isDeprecated: a => typeof a.deprecationReason === 'string',
    usage,
  },
};

function stringifyDefaultValue(value: unknown): string | null {
  if (typeof value !== 'undefined') {
    return JSON.stringify(value);
  }
  return null;
}
