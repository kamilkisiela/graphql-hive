import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';
import { type CodegenConfig } from '@graphql-codegen/cli';
import { addTypenameSelectionDocumentTransform } from '@graphql-codegen/client-preset';

const config: CodegenConfig = {
  schema: './packages/services/api/src/modules/*/module.graphql.ts',
  emitLegacyCommonJSImports: true,
  generates: {
    // API
    './packages/services/api/src': defineConfig(
      {
        typeDefsFilePath: false,
        mergeSchema: {
          path: '../../../../schema.graphql',
          config: { includeDirectives: true },
        },
        resolverGeneration: 'minimal',
        resolverMainFileMode: 'modules',
        resolverTypesPath: './__generated__/types.next.ts',
        blacklistedModules: ['collection', 'lab', 'operations', 'organization'],
        scalarsOverrides: {
          DateTime: {
            type: { input: 'Date', output: 'Date | string | number' },
          },
          Date: { type: 'string' },
          SafeInt: { type: 'number' },
          ID: { type: 'string' },
        },
        typesPluginsConfig: {
          immutableTypes: true,
          namingConvention: 'change-case-all#pascalCase', // TODO: This is triggering a warning about type name not working 100% of the time. eddeee888 to fix in Server Preset by using `meta` field.
          contextType: 'GraphQLModules.ModuleContext',
          enumValues: {
            ProjectType: '../shared/entities#ProjectType',
            NativeFederationCompatibilityStatus:
              '../shared/entities#NativeFederationCompatibilityStatus',
            TargetAccessScope: '../modules/auth/providers/target-access#TargetAccessScope',
            ProjectAccessScope: '../modules/auth/providers/project-access#ProjectAccessScope',
            OrganizationAccessScope:
              '../modules/auth/providers/organization-access#OrganizationAccessScope',
            SupportTicketPriority: '../shared/entities#SupportTicketPriority',
            SupportTicketStatus: '../shared/entities#SupportTicketStatus',
          },
          resolversNonOptionalTypename: {
            interfaceImplementingType: true,
            unionMember: true,
            excludeTypes: ['TokenInfoPayload', 'Schema', 'GraphQLNamedType'],
          },
        },
      },
      {
        hooks: {
          afterOneFileWrite: ['prettier --write'],
        },
      },
    ),
    './packages/services/api/src/modules': {
      preset: 'graphql-modules',
      plugins: ['typescript', 'typescript-resolvers'],
      presetConfig: {
        baseTypesPath: '../__generated__/types.ts',
        filename: '__generated__/types.ts',
        encapsulateModuleTypes: 'namespace',
      },
      config: {
        immutableTypes: true,
        contextType: 'GraphQLModules.ModuleContext',
        enumValues: {
          ProjectType: '../shared/entities#ProjectType',
          NativeFederationCompatibilityStatus:
            '../shared/entities#NativeFederationCompatibilityStatus',
          TargetAccessScope: '../modules/auth/providers/target-access#TargetAccessScope',
          ProjectAccessScope: '../modules/auth/providers/project-access#ProjectAccessScope',
          OrganizationAccessScope:
            '../modules/auth/providers/organization-access#OrganizationAccessScope',
          SupportTicketPriority: '../shared/entities#SupportTicketPriority',
          SupportTicketStatus: '../shared/entities#SupportTicketStatus',
        },
        scalars: {
          DateTime: 'string',
          Date: 'string',
          SafeInt: 'number',
          ID: 'string',
        },
        mappers: {
          SchemaChange: '../modules/schema/module.graphql.mappers#SchemaChangeMapper',
          SchemaChangeApproval:
            '../modules/schema/module.graphql.mappers#SchemaChangeApprovalMapper',
          SchemaChangeConnection:
            '../modules/schema/module.graphql.mappers#SchemaChangeConnectionMapper',
          SchemaErrorConnection:
            '../modules/schema/module.graphql.mappers#SchemaErrorConnectionMapper',
          SchemaWarningConnection:
            '../modules/schema/module.graphql.mappers#SchemaWarningConnectionMapper',
          OrganizationConnection:
            '../modules/organization/module.graphql.mappers#OrganizationConnectionMapper',
          UserConnection: '../modules/auth/module.graphql.mappers#UserConnectionMapper',
          MemberConnection: '../modules/auth/module.graphql.mappers#MemberConnectionMapper',
          ProjectConnection: '../modules/project/module.graphql.mappers#ProjectConnectionMapper',
          TargetConnection: '../modules/target/module.graphql.mappers#TargetConnectionMapper',
          SchemaConnection: '../modules/schema/module.graphql.mappers#SchemaConnectionMapper',
          TokenConnection: '../modules/token/module.graphql.mappers#TokenConnectionMapper',
          OperationStatsValuesConnection:
            '../modules/operations/module.graphql.mappers#OperationStatsValuesConnectionMapper',
          ClientStatsValuesConnection:
            '../modules/operations/module.graphql.mappers#ClientStatsValuesConnectionMapper',
          SchemaCoordinateStats:
            '../modules/operations/module.graphql.mappers#SchemaCoordinateStatsMapper',
          ClientStats: '../modules/operations/module.graphql.mappers#ClientStatsMapper',
          OperationsStats: '../modules/operations/module.graphql.mappers#OperationsStatsMapper',
          DurationValues: '../modules/operations/module.graphql.mappers#DurationValuesMapper',
          SchemaVersionConnection:
            '../modules/schema/module.graphql.mappers#SchemaVersionConnectionMapper',
          SchemaVersion: '../modules/schema/module.graphql.mappers#SchemaVersionMapper',
          Schema: '../modules/schema/module.graphql.mappers#SchemaMapper',
          SingleSchema: '../modules/schema/module.graphql.mappers#SingleSchemaMapper',
          CompositeSchema: '../modules/schema/module.graphql.mappers#CompositeSchemaMapper',
          Organization: '../modules/organization/module.graphql.mappers#OrganizationMapper',
          Project: '../modules/project/module.graphql.mappers#ProjectMapper',
          Target: '../modules/target/module.graphql.mappers#TargetMapper',
          Member: '../modules/auth/module.graphql.mappers#MemberMapper',
          MemberRole: '../modules/organization/module.graphql.mappers#MemberRoleMapper',
          Token: '../modules/token/module.graphql.mappers#TokenMapper',
          TokenInfo: '../modules/token/module.graphql.mappers#TokenInfoMapper',
          AlertChannel: '../modules/alerts/module.graphql.mappers#AlertChannelMapper',
          AlertSlackChannel: '../modules/alerts/module.graphql.mappers#AlertSlackChannelMapper',
          AlertWebhookChannel: '../modules/alerts/module.graphql.mappers#AlertWebhookChannelMapper',
          TeamsWebhookChannel: '../modules/alerts/module.graphql.mappers#TeamsWebhookChannelMapper',
          Alert: '../modules/alerts/module.graphql.mappers#AlertMapper',
          AdminQuery: '../modules/admin/module.graphql.mappers#AdminQueryMapper',
          AdminStats: '../modules/admin/module.graphql.mappers#AdminStatsMapper',
          AdminGeneralStats: '../modules/admin/module.graphql.mappers#AdminGeneralStatsMapper',
          AdminOrganizationStats:
            '../modules/admin/module.graphql.mappers#AdminOrganizationStatsMapper',
          BillingPaymentMethod:
            '../modules/billing/module.graphql.mappers#BillingPaymentMethodMapper',
          BillingDetails: '../modules/billing/module.graphql.mappers#BillingDetailsMapper',
          BillingInvoice: '../modules/billing/module.graphql.mappers#BillingInvoiceMapper',
          OrganizationGetStarted:
            '../modules/organization/module.graphql.mappers#OrganizationGetStartedMapper',
          SchemaExplorer: '../modules/schema/module.graphql.mappers#SchemaExplorerMapper',
          UnusedSchemaExplorer:
            '../modules/schema/module.graphql.mappers#UnusedSchemaExplorerMapper',
          DeprecatedSchemaExplorer:
            '../modules/schema/module.graphql.mappers#DeprecatedSchemaExplorerMapper',
          GraphQLObjectType: '../modules/schema/module.graphql.mappers#GraphQLObjectTypeMapper',
          GraphQLInterfaceType:
            '../modules/schema/module.graphql.mappers#GraphQLInterfaceTypeMapper',
          GraphQLUnionType: '../modules/schema/module.graphql.mappers#GraphQLUnionTypeMapper',
          GraphQLEnumType: '../modules/schema/module.graphql.mappers#GraphQLEnumTypeMapper',
          GraphQLInputObjectType:
            '../modules/schema/module.graphql.mappers#GraphQLInputObjectTypeMapper',
          GraphQLScalarType: '../modules/schema/module.graphql.mappers#GraphQLScalarTypeMapper',
          GraphQLUnionTypeMember:
            '../modules/schema/module.graphql.mappers#GraphQLUnionTypeMemberMapper',
          GraphQLEnumValue: '../modules/schema/module.graphql.mappers#GraphQLEnumValueMapper',
          GraphQLField: '../modules/schema/module.graphql.mappers#GraphQLFieldMapper',
          GraphQLInputField: '../modules/schema/module.graphql.mappers#GraphQLInputFieldMapper',
          GraphQLArgument: '../modules/schema/module.graphql.mappers#GraphQLArgumentMapper',
          OrganizationInvitation:
            '../modules/organization/module.graphql.mappers#OrganizationInvitationMapper',
          OIDCIntegration:
            '../modules/oidc-integrations/module.graphql.mappers#OIDCIntegrationMapper',
          User: '../modules/auth/module.graphql.mappers#UserMapper',
          SchemaPolicy: '../modules/policy/module.graphql.mappers#SchemaPolicyMapper',
          SchemaPolicyRule: '../modules/policy/module.graphql.mappers#SchemaPolicyRuleMapper',
          SchemaCoordinateUsage:
            '../modules/schema/module.graphql.mappers#SchemaCoordinateUsageMapper',
          DocumentCollection:
            '../modules/collection/module.graphql.mappers#DocumentCollectionMapper',
          DocumentCollectionOperation:
            '../modules/collection/module.graphql.mappers#DocumentCollectionOperationMapper',
          DocumentCollectionConnection:
            '../modules/collection/module.graphql.mappers#DocumentCollectionConnectionMapper',
          DocumentCollectionOperationsConnection:
            '../modules/collection/module.graphql.mappers#DocumentCollectionOperationsConnectionMapper',
          FailedSchemaCheck: '../modules/schema/module.graphql.mappers#FailedSchemaCheckMapper',
          SuccessfulSchemaCheck:
            '../modules/schema/module.graphql.mappers#SuccessfulSchemaCheckMapper',
          SchemaPolicyWarningConnection:
            '../modules/schema/module.graphql.mappers#SchemaPolicyWarningConnectionMapper',
          Contract: '../modules/schema/module.graphql.mappers#ContractMapper',
          ContractConnection: '../modules/schema/module.graphql.mappers#ContractConnectionMapper',
          ContractCheck: '../modules/schema/module.graphql.mappers#ContractCheckMapper',
          ContractVersion: '../modules/schema/module.graphql.mappers#ContractVersionMapper',
          BreakingChangeMetadataTarget:
            '../modules/schema/module.graphql.mappers#BreakingChangeMetadataTargetMapper',
          AppDeployment: '../modules/app-deployments/module.graphql.mappers#AppDeploymentMapper',
          AppDeploymentStatus:
            '../modules/app-deployments/module.graphql.mappers#AppDeploymentStatusMapper',
        },
      },
    },
    './packages/web/app/src/gql/': {
      documents: [
        './packages/web/app/src/(components|lib|pages)/**/*.ts(x)?',
        '!./packages/web/app/src/server/**/*.ts',
      ],
      preset: 'client',
      config: {
        scalars: {
          DateTime: 'string',
          Date: 'string',
          SafeInt: 'number',
          JSONSchemaObject: 'json-schema-typed#JSONSchema',
        },
      },
      presetConfig: {
        persistedDocuments: true,
      },
      plugins: [],
      documentTransforms: [addTypenameSelectionDocumentTransform],
    },
    './packages/web/app/src/gql/schema.ts': {
      plugins: ['urql-introspection'],
      config: {
        useTypeImports: true,
        module: 'es2015',
      },
    },
    // CLI
    './packages/libraries/cli/src/gql/': {
      documents: ['./packages/libraries/cli/src/(commands|helpers)/**/*.ts'],
      preset: 'client',
      plugins: [],
      config: {
        useTypeImports: true,
      },
    },
    // Client
    'packages/libraries/core/src/client/__generated__/types.ts': {
      documents: ['./packages/libraries/core/src/client/**/*.ts'],
      config: {
        flattenGeneratedTypes: true,
        onlyOperationTypes: true,
      },
      plugins: ['typescript', 'typescript-operations'],
    },
    // Integration tests
    './integration-tests/testkit/gql/': {
      documents: ['./integration-tests/(testkit|tests)/**/*.ts'],
      preset: 'client',
      plugins: [],
      config: {
        scalars: {
          DateTime: 'string',
          Date: 'string',
          SafeInt: 'number',
        },
      },
    },
  },
};

module.exports = config;
