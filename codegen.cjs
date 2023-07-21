// @ts-check

/** @type {import('@graphql-codegen/cli').CodegenConfig} */
const config = {
  schema: './packages/services/api/src/modules/*/module.graphql.ts',
  emitLegacyCommonJSImports: true,
  generates: {
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
          TargetAccessScope: '../modules/auth/providers/target-access#TargetAccessScope',
          ProjectAccessScope: '../modules/auth/providers/project-access#ProjectAccessScope',
          OrganizationAccessScope:
            '../modules/auth/providers/organization-access#OrganizationAccessScope',
        },
        scalars: {
          DateTime: 'string',
          SafeInt: 'number',
          ID: 'string',
        },
        mappers: {
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
          OperationStatsConnection:
            '../shared/mappers#OperationStatsConnection as OperationStatsConnectionMapper',
          ClientStatsConnection:
            '../shared/mappers#ClientStatsConnection as ClientStatsConnectionMapper',
          OperationsStats: '../shared/mappers#OperationsStats as OperationsStatsMapper',
          DurationStats: '../shared/mappers#DurationStats as DurationStatsMapper',
          SchemaComparePayload:
            '../shared/mappers#SchemaComparePayload as SchemaComparePayloadMapper',
          SchemaCompareResult: '../shared/mappers#SchemaCompareResult as SchemaCompareResultMapper',
          SchemaCompareError: '../shared/mappers#SchemaCompareError as SchemaCompareErrorMapper',
          SchemaVersionConnection:
            '../shared/mappers#SchemaVersionConnection as SchemaVersionConnectionMapper',
          SchemaVersion: '../shared/mappers#SchemaVersion as SchemaVersionMapper',
          Schema: '../shared/mappers#Schema as SchemaMapper',
          SingleSchema: '../shared/mappers#SingleSchema as SingleSchemaMapper',
          CompositeSchema: '../shared/mappers#PushedCompositeSchema as PushedCompositeSchemaMapper',
          PersistedOperationConnection:
            '../shared/mappers#PersistedOperationConnection as PersistedOperationMapper',
          Organization: '../shared/entities#Organization as OrganizationMapper',
          Project: '../shared/entities#Project as ProjectMapper',
          Target: '../shared/entities#Target as TargetMapper',
          Member: '../shared/entities#Member as MemberMapper',
          Token: '../shared/entities#Token as TokenMapper',
          TokenInfo: '../shared/entities#Token as TokenInfoMapper',
          Activity: '../shared/entities#ActivityObject as ActivityMapper',
          AlertChannel: '../shared/entities#AlertChannel as AlertChannelMapper',
          AlertSlackChannel: 'AlertChannelMapper',
          AlertWebhookChannel: 'AlertChannelMapper',
          Alert: '../shared/entities#Alert as AlertMapper',
          AdminQuery: '{}',
          AdminStats: '../shared/mappers#AdminStats as AdminStatsMapper',
          AdminGeneralStats: '../shared/mappers#AdminStats as AdminGeneralStatsMapper',
          AdminOrganizationStats:
            '../shared/entities#AdminOrganizationStats as AdminOrganizationStatsMapper',
          UsageEstimation: '../shared/mappers#TargetsEstimationFilter',
          UsageEstimationScope: '../shared/mappers#TargetsEstimationDateFilter',
          BillingPaymentMethod: 'StripeTypes.PaymentMethod.Card',
          BillingDetails: 'StripeTypes.PaymentMethod.BillingDetails',
          BillingInvoice: 'StripeTypes.Invoice | StripeTypes.UpcomingInvoice',
          OrganizationGetStarted:
            '../shared/entities#OrganizationGetStarted as OrganizationGetStartedMapper',
          SchemaExplorer: '../shared/mappers#SchemaExplorerMapper',
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
        },
      },
    },
    // App
    './packages/web/app/src/graphql/index.ts': {
      documents: [
        './packages/web/app/src/graphql/*.graphql',
        './packages/web/app/src/(components|lib)/**/*.ts(x)?',
      ],
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      config: {
        dedupeFragments: true,
        scalars: {
          DateTime: 'string',
          SafeInt: 'number',
          JSONSchemaObject: 'json-schema-typed#JSONSchema',
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
          SafeInt: 'number',
          JSONSchemaObject: 'json-schema-typed#JSONSchema',
        },
      },
      presetConfig: {
        persistedDocuments: true,
      },
      plugins: [],
    },
    // CLI
    './packages/libraries/cli/src/gql/': {
      documents: ['./packages/libraries/cli/src/commands/**/*.ts'],
      preset: 'client',
      plugins: [],
      config: {
        useTypeImports: true,
      },
    },
    // Client
    'packages/libraries/client/src/__generated__/types.ts': {
      documents: ['./packages/libraries/client/src/**/*.ts'],
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
  },
};

module.exports = config;
