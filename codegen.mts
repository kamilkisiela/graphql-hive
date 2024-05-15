import { defineConfig } from '@eddeee888/gcg-typescript-resolver-files';
import { type CodegenConfig } from '@graphql-codegen/cli';
import { addTypenameSelectionDocumentTransform } from '@graphql-codegen/client-preset';

const config: CodegenConfig = {
  schema: './packages/services/api/src/modules/*/module.graphql.ts',
  emitLegacyCommonJSImports: true,
  generates: {
    // Server preset
    './packages/services/api/src': defineConfig({
      add: {
        './__generated__/types.next.ts': {
          content: "import type { StripeTypes } from '@hive/stripe-billing';",
        },
      },
      typeDefsFilePath: false,
      resolverMainFileMode: 'modules',
      resolverTypesPath: './__generated__/types.next.ts',
      whitelistedModules: ['usage-estimation', 'admin'],
      scalarsOverrides: {
        DateTime: { type: 'string' },
        Date: { type: 'string' },
        SafeInt: { type: 'number' },
        ID: { type: 'string' },
      },
      typesPluginsConfig: {
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
        mappers: {
          SchemaChange: '../shared/mappers#SchemaChange as SchemaChangeMapper',
          SchemaChangeApproval:
            '../shared/mappers#SchemaChangeApproval as SchemaChangeApprovalMapper',
          SchemaChangeConnection:
            '../shared/mappers#SchemaChangeConnection as SchemaChangeConnectionMapper',
          SchemaErrorConnection:
            '../shared/mappers#SchemaErrorConnection as SchemaErrorConnectionMapper',
          SchemaWarningConnection:
            '../shared/mappers#SchemaWarningConnection as SchemaWarningConnectionMapper',
          OrganizationConnection:
            '../shared/mappers#OrganizationConnection as OrganizationConnectionMapper',
          UserConnection: '../shared/mappers#UserConnection as UserConnectionMapper',
          ActivityConnection: '../shared/mappers#ActivityConnection as ActivityConnectionMapper',
          MemberConnection: '../shared/mappers#MemberConnection as MemberConnectionMapper',
          ProjectConnection: '../shared/mappers#ProjectConnection as ProjectConnectionMapper',
          TargetConnection: '../shared/mappers#TargetConnection as TargetConnectionMapper',
          SchemaConnection: '../shared/mappers#SchemaConnection as SchemaConnectionMapper',
          TokenConnection: '../shared/mappers#TokenConnection as TokenConnectionMapper',
          OperationStatsValuesConnection:
            '../shared/mappers#OperationStatsValuesConnection as OperationStatsValuesConnectionMapper',
          ClientStatsValuesConnection:
            '../shared/mappers#ClientStatsValuesConnection as ClientStatsValuesConnectionMapper',
          SchemaCoordinateStats:
            '../shared/mappers#SchemaCoordinateStats as SchemaCoordinateStatsMapper',
          ClientStats: '../shared/mappers#ClientStats as ClientStatsMapper',
          OperationsStats: '../shared/mappers#OperationsStats as OperationsStatsMapper',
          DurationValues: '../shared/mappers#DurationValues as DurationValuesMapper',
          SchemaComparePayload:
            '../shared/mappers#SchemaComparePayload as SchemaComparePayloadMapper',
          SchemaCompareResult: '../shared/mappers#SchemaCompareResult as SchemaCompareResultMapper',
          SchemaCompareError: '../shared/mappers#SchemaCompareError as SchemaCompareErrorMapper',
          SchemaVersionConnection:
            '../modules/shared/providers/storage#PaginatedSchemaVersionConnection as SchemaVersionConnectionMapper',
          SchemaVersion: '../shared/mappers#SchemaVersion as SchemaVersionMapper',
          Schema: '../shared/mappers#Schema as SchemaMapper',
          SingleSchema: '../shared/mappers#SingleSchema as SingleSchemaMapper',
          CompositeSchema: '../shared/mappers#PushedCompositeSchema as PushedCompositeSchemaMapper',
          Organization: '../shared/entities#Organization as OrganizationMapper',
          Project: '../shared/entities#Project as ProjectMapper',
          Target: '../shared/entities#Target as TargetMapper',
          Member: '../shared/entities#Member as MemberMapper',
          MemberRole: '../shared/mappers#MemberRoleMapper as MemberRoleMapper',
          Token: '../shared/entities#Token as TokenMapper',
          TokenInfo: '../shared/entities#Token as TokenInfoMapper',
          Activity: '../shared/entities#ActivityObject as ActivityMapper',
          AlertChannel: '../shared/entities#AlertChannel as AlertChannelMapper',
          AlertSlackChannel: 'AlertChannelMapper',
          AlertWebhookChannel: 'AlertChannelMapper',
          Alert: '../shared/entities#Alert as AlertMapper',
          AdminQuery: '{}',
          AdminStats: '../modules/admin/module.graphql.mappers#AdminStatsMapper',
          AdminGeneralStats: '../shared/mappers#AdminStats as AdminGeneralStatsMapper',
          AdminOrganizationStats:
            '../shared/entities#AdminOrganizationStats as AdminOrganizationStatsMapper',
          BillingPaymentMethod: 'StripeTypes.PaymentMethod.Card',
          BillingDetails: 'StripeTypes.PaymentMethod.BillingDetails',
          BillingInvoice: 'StripeTypes.Invoice | StripeTypes.UpcomingInvoice',
          OrganizationGetStarted:
            '../shared/entities#OrganizationGetStarted as OrganizationGetStartedMapper',
          SchemaExplorer: '../shared/mappers#SchemaExplorerMapper',
          UnusedSchemaExplorer: '../shared/mappers#UnusedSchemaExplorerMapper',
          DeprecatedSchemaExplorer: '../shared/mappers#DeprecatedSchemaExplorerMapper',
          GraphQLObjectType: '../shared/mappers#GraphQLObjectTypeMapper',
          GraphQLInterfaceType: '../shared/mappers#GraphQLInterfaceTypeMapper',
          GraphQLUnionType: '../shared/mappers#GraphQLUnionTypeMapper',
          GraphQLEnumType: '../shared/mappers#GraphQLEnumTypeMapper',
          GraphQLInputObjectType: '../shared/mappers#GraphQLInputObjectTypeMapper',
          GraphQLScalarType: '../shared/mappers#GraphQLScalarTypeMapper',
          GraphQLUnionTypeMember: '../shared/mappers#GraphQLUnionTypeMemberMapper',
          GraphQLEnumValue: '../shared/mappers#GraphQLEnumValueMapper',
          GraphQLField: '../shared/mappers#GraphQLFieldMapper',
          GraphQLInputField: '../shared/mappers#GraphQLInputFieldMapper',
          GraphQLArgument: '../shared/mappers#GraphQLArgumentMapper',
          OrganizationInvitation:
            '../shared/entities#OrganizationInvitation as OrganizationInvitationMapper',
          OIDCIntegration: '../shared/entities#OIDCIntegration as OIDCIntegrationMapper',
          User: '../shared/entities#User as UserMapper',
          SchemaPolicy: '../shared/entities#SchemaPolicy as SchemaPolicyMapper',
          SchemaPolicyRule: '../shared/entities#SchemaPolicyAvailableRuleObject',
          SchemaCoordinateUsage: '../shared/mappers#SchemaCoordinateUsageTypeMapper',
          DocumentCollection: '../shared/entities#DocumentCollection as DocumentCollectionEntity',
          DocumentCollectionOperation:
            '../shared/entities#DocumentCollectionOperation as DocumentCollectionOperationEntity',
          DocumentCollectionConnection: '../shared/entities#PaginatedDocumentCollections',
          DocumentCollectionOperationsConnection:
            '../shared/entities#PaginatedDocumentCollectionOperations',
          FailedSchemaCheck: '../shared/mappers#FailedSchemaCheckMapper',
          SuccessfulSchemaCheck: '../shared/mappers#SuccessfulSchemaCheckMapper',
          SchemaPolicyWarningConnection: '../shared/mappers#SchemaPolicyWarningConnectionMapper',
          Contract: '../shared/mappers#Contract as ContractMapper',
          ContractConnection: '../modules/schema/providers/contracts#PaginatedContractConnection',
          ContractCheck:
            '../modules/schema/providers/contracts#ContractCheck as ContractCheckMapper',
          ContractVersion:
            '../modules/schema/providers/contracts#ContractVersion as ContractVersionMapper',
          BreakingChangeMetadataTarget:
            '../shared/mappers#BreakingChangeMetadataTarget as BreakingChangeMetadataTargetMapper',
        },
      },
    }),
    // API
    './packages/services/api/src/modules': {
      preset: 'graphql-modules',
      plugins: [
        {
          add: {
            content: "import type { StripeTypes } from '@hive/stripe-billing';",
          },
        },
        'typescript',
        'typescript-resolvers',
      ],
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
          SchemaChange: '../shared/mappers#SchemaChange as SchemaChangeMapper',
          SchemaChangeApproval:
            '../shared/mappers#SchemaChangeApproval as SchemaChangeApprovalMapper',
          SchemaChangeConnection:
            '../shared/mappers#SchemaChangeConnection as SchemaChangeConnectionMapper',
          SchemaErrorConnection:
            '../shared/mappers#SchemaErrorConnection as SchemaErrorConnectionMapper',
          SchemaWarningConnection:
            '../shared/mappers#SchemaWarningConnection as SchemaWarningConnectionMapper',
          OrganizationConnection:
            '../shared/mappers#OrganizationConnection as OrganizationConnectionMapper',
          UserConnection: '../shared/mappers#UserConnection as UserConnectionMapper',
          ActivityConnection: '../shared/mappers#ActivityConnection as ActivityConnectionMapper',
          MemberConnection: '../shared/mappers#MemberConnection as MemberConnectionMapper',
          ProjectConnection: '../shared/mappers#ProjectConnection as ProjectConnectionMapper',
          TargetConnection: '../shared/mappers#TargetConnection as TargetConnectionMapper',
          SchemaConnection: '../shared/mappers#SchemaConnection as SchemaConnectionMapper',
          TokenConnection: '../shared/mappers#TokenConnection as TokenConnectionMapper',
          OperationStatsValuesConnection:
            '../shared/mappers#OperationStatsValuesConnection as OperationStatsValuesConnectionMapper',
          ClientStatsValuesConnection:
            '../shared/mappers#ClientStatsValuesConnection as ClientStatsValuesConnectionMapper',
          SchemaCoordinateStats:
            '../shared/mappers#SchemaCoordinateStats as SchemaCoordinateStatsMapper',
          ClientStats: '../shared/mappers#ClientStats as ClientStatsMapper',
          OperationsStats: '../shared/mappers#OperationsStats as OperationsStatsMapper',
          DurationValues: '../shared/mappers#DurationValues as DurationValuesMapper',
          SchemaComparePayload:
            '../shared/mappers#SchemaComparePayload as SchemaComparePayloadMapper',
          SchemaCompareResult: '../shared/mappers#SchemaCompareResult as SchemaCompareResultMapper',
          SchemaCompareError: '../shared/mappers#SchemaCompareError as SchemaCompareErrorMapper',
          SchemaVersionConnection:
            '../modules/shared/providers/storage#PaginatedSchemaVersionConnection as SchemaVersionConnectionMapper',
          SchemaVersion: '../shared/mappers#SchemaVersion as SchemaVersionMapper',
          Schema: '../shared/mappers#Schema as SchemaMapper',
          SingleSchema: '../shared/mappers#SingleSchema as SingleSchemaMapper',
          CompositeSchema: '../shared/mappers#PushedCompositeSchema as PushedCompositeSchemaMapper',
          Organization: '../shared/entities#Organization as OrganizationMapper',
          Project: '../shared/entities#Project as ProjectMapper',
          Target: '../shared/entities#Target as TargetMapper',
          Member: '../shared/entities#Member as MemberMapper',
          MemberRole: '../shared/mappers#MemberRoleMapper as MemberRoleMapper',
          Token: '../shared/entities#Token as TokenMapper',
          TokenInfo: '../shared/entities#Token as TokenInfoMapper',
          Activity: '../shared/entities#ActivityObject as ActivityMapper',
          AlertChannel: '../shared/entities#AlertChannel as AlertChannelMapper',
          AlertSlackChannel: 'AlertChannelMapper',
          AlertWebhookChannel: 'AlertChannelMapper',
          Alert: '../shared/entities#Alert as AlertMapper',
          AdminQuery: '{}',
          AdminStats: '../modules/admin/module.graphql.mappers#AdminStatsMapper',
          AdminGeneralStats: '../shared/mappers#AdminStats as AdminGeneralStatsMapper',
          AdminOrganizationStats:
            '../shared/entities#AdminOrganizationStats as AdminOrganizationStatsMapper',
          BillingPaymentMethod: 'StripeTypes.PaymentMethod.Card',
          BillingDetails: 'StripeTypes.PaymentMethod.BillingDetails',
          BillingInvoice: 'StripeTypes.Invoice | StripeTypes.UpcomingInvoice',
          OrganizationGetStarted:
            '../shared/entities#OrganizationGetStarted as OrganizationGetStartedMapper',
          SchemaExplorer: '../shared/mappers#SchemaExplorerMapper',
          UnusedSchemaExplorer: '../shared/mappers#UnusedSchemaExplorerMapper',
          DeprecatedSchemaExplorer: '../shared/mappers#DeprecatedSchemaExplorerMapper',
          GraphQLObjectType: '../shared/mappers#GraphQLObjectTypeMapper',
          GraphQLInterfaceType: '../shared/mappers#GraphQLInterfaceTypeMapper',
          GraphQLUnionType: '../shared/mappers#GraphQLUnionTypeMapper',
          GraphQLEnumType: '../shared/mappers#GraphQLEnumTypeMapper',
          GraphQLInputObjectType: '../shared/mappers#GraphQLInputObjectTypeMapper',
          GraphQLScalarType: '../shared/mappers#GraphQLScalarTypeMapper',
          GraphQLUnionTypeMember: '../shared/mappers#GraphQLUnionTypeMemberMapper',
          GraphQLEnumValue: '../shared/mappers#GraphQLEnumValueMapper',
          GraphQLField: '../shared/mappers#GraphQLFieldMapper',
          GraphQLInputField: '../shared/mappers#GraphQLInputFieldMapper',
          GraphQLArgument: '../shared/mappers#GraphQLArgumentMapper',
          OrganizationInvitation:
            '../shared/entities#OrganizationInvitation as OrganizationInvitationMapper',
          OIDCIntegration: '../shared/entities#OIDCIntegration as OIDCIntegrationMapper',
          User: '../shared/entities#User as UserMapper',
          SchemaPolicy: '../shared/entities#SchemaPolicy as SchemaPolicyMapper',
          SchemaPolicyRule: '../shared/entities#SchemaPolicyAvailableRuleObject',
          SchemaCoordinateUsage: '../shared/mappers#SchemaCoordinateUsageTypeMapper',
          DocumentCollection: '../shared/entities#DocumentCollection as DocumentCollectionEntity',
          DocumentCollectionOperation:
            '../shared/entities#DocumentCollectionOperation as DocumentCollectionOperationEntity',
          DocumentCollectionConnection: '../shared/entities#PaginatedDocumentCollections',
          DocumentCollectionOperationsConnection:
            '../shared/entities#PaginatedDocumentCollectionOperations',
          FailedSchemaCheck: '../shared/mappers#FailedSchemaCheckMapper',
          SuccessfulSchemaCheck: '../shared/mappers#SuccessfulSchemaCheckMapper',
          SchemaPolicyWarningConnection: '../shared/mappers#SchemaPolicyWarningConnectionMapper',
          Contract: '../shared/mappers#Contract as ContractMapper',
          ContractConnection: '../modules/schema/providers/contracts#PaginatedContractConnection',
          ContractCheck:
            '../modules/schema/providers/contracts#ContractCheck as ContractCheckMapper',
          ContractVersion:
            '../modules/schema/providers/contracts#ContractVersion as ContractVersionMapper',
          BreakingChangeMetadataTarget:
            '../shared/mappers#BreakingChangeMetadataTarget as BreakingChangeMetadataTargetMapper',
        },
      },
    },
    './packages/web/app/src/gql/': {
      documents: [
        './packages/web/app/src/(components|lib)/**/*.ts(x)?',
        './packages/web/app/pages/v2/**/*.ts(x)?',
        './packages/web/app/pages/**/*.ts(x)?',
        './packages/web/app/src/graphql',
        '!./packages/web/app/pages/api/github/setup-callback.ts',
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
    },
    './schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
      },
    },
  },
};

module.exports = config;
