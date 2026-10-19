/**
 * Policy configs in the shape stored in `schema_policy_config.config`. Combines the
 * "existing policies" list from #7913 with the real config samples collected in #6657
 * (mapped back to v3 shapes), deduplicated.
 */
export const storedPolicies = [
  {
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'Argument[type.type=InputObjectTypeDefinition]': {
          style: 'PascalCase',
          suffix: 'Args',
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          suffixes: ['PageInfo', 'Edge', 'Connection', 'Nested', 'Error', 'Payload'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      2,
      {
        types: true,
        rootField: false,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: false,
        UnionTypeDefinition: true,
        InputValueDefinition: false,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-date': [
      1,
      {
        argumentName: 'deleteBy',
      },
    ],
    'require-deprecation-reason': [2],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: {
          style: 'PascalCase',
          forbiddenSuffixes: ['Failure'],
        },
        Argument: {
          style: 'camelCase',
          forbiddenPrefixes: ['userUuid'],
          forbiddenSuffixes: ['UserId', 'userUuid'],
        },
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern: '^federation_',
        },
        InputValueDefinition: {
          style: 'camelCase',
          forbiddenSuffixes: ['UserId'],
        },
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['post', 'put', 'mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription', 'subscribe'],
          forbiddenSuffixes: ['Subscription'],
        },
        'FieldDefinition[parent.name.value=/.*(Error|Exception)/]': {
          forbiddenPrefixes: ['message'],
          forbiddenSuffixes: ['Message'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: [
            'MonetaryAmount',
            'PageInfo',
            'MarketReturn',
            'InvestmentCategory',
            'SecurityHeadline',
            'ETFPrice',
            'StatementLink',
            'Eligibility',
            'Image',
            'StringKeyAsset',
          ],
          suffixes: ['CurrencyAmount', 'Error', 'Exception', 'Failure'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [
      1,
      {
        values: ['EnumTypeDefinition'],
        definitions: false,
      },
    ],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-scalar-result-type-on-mutation': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        DirectiveDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        definitions: false,
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
  },
  {},
  {
    'require-deprecation-date': [
      1,
      {
        argumentName: 'deletionDate',
      },
    ],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition'],
        definitions: false,
      },
    ],
  },
  {
    'strict-id-in-types': [
      1,
      {
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        DirectiveDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [
      1,
      {
        values: ['EnumTypeDefinition'],
        definitions: false,
      },
    ],
    'relay-arguments': [
      2,
      {
        includeBoth: false,
      },
    ],
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: false,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Type', 'type'],
          forbiddenSuffixes: ['Type', 'type'],
        },
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        EnumTypeDefinition: {
          forbiddenPrefixes: ['enum', 'Enum'],
          forbiddenSuffixes: ['enum', 'Enum'],
        },
        FragmentDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Fragment'],
          forbiddenSuffixes: ['Fragment'],
        },
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        UnionTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['union', 'Union'],
          forbiddenSuffixes: ['union', 'Union'],
        },
        InputValueDefinition: 'camelCase',
        ObjectTypeDefinition: {
          forbiddenPrefixes: ['Type'],
          forbiddenSuffixes: ['Type'],
        },
        InterfaceTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['interface', 'Interface'],
          forbiddenSuffixes: ['interface', 'Interface'],
        },
        InputObjectTypeDefinition: 'PascalCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          requiredPrefixes: ['create', 'update', 'delete', 'terminate', 'add', 'remove'],
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: false,
      },
    ],
    'no-root-type': [
      1,
      {
        disallow: ['mutation', 'subscription'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'inline',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'strict-id-in-types': [
      1,
      {
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      2,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-date': [1],
    'require-type-pattern-with-oneof': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition'],
        definitions: true,
      },
    ],
    'relay-arguments': [
      2,
      {
        includeBoth: true,
      },
    ],
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        allowLeadingUnderscore: true,
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'create', 'delete', 'get', 'is', 'remove', 'set', 'update'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: [
            'mutation',
            'create',
            'delete',
            'get',
            'is',
            'remove',
            'set',
            'update',
          ],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      2,
      {
        rootField: true,
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['Field', 'Directive', 'DirectiveDefinition', 'FieldDefinition'],
        definitions: true,
      },
    ],
  },
  {
    alphabetize: [
      2,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['Field', 'FieldDefinition'],
        definitions: false,
      },
    ],
  },
  {
    'strict-id-in-types': [0],
  },
  {
    'require-description': [
      1,
      {
        types: true,
        rootField: false,
        FieldDefinition: false,
        EnumTypeDefinition: false,
        DirectiveDefinition: false,
        OperationDefinition: false,
        InputValueDefinition: false,
        ScalarTypeDefinition: false,
        InputObjectTypeDefinition: false,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      2,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        values: ['EnumTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: true,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-date': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'require-deprecation-reason': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'no-root-type': [
      1,
      {
        disallow: ['subscription'],
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'PascalCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-unreachable-types': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'require-description': [
      1,
      {
        types: true,
        DirectiveDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
  },
  {
    'input-name': [0],
    alphabetize: [0],
    'relay-arguments': [0],
    'relay-page-info': [0],
    'relay-edge-types': [0],
    'naming-convention': [0],
    'no-hashtag-description': [0],
    'relay-connection-types': [0],
    'require-deprecation-reason': [0],
    'no-scalar-result-type-on-mutation': [0],
    'no-case-insensitive-enum-values-duplicates': [0],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list', 'fetch'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-reason': [1],
    'require-nullable-result-in-root': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'no-root-type': [
      2,
      {
        disallow: ['subscription'],
      },
    ],
    'relay-arguments': [
      2,
      {
        includeBoth: true,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'relay-connection-types': [2],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
    'require-nullable-fields-with-oneof': [2],
  },
  {
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-typename-prefix': [2],
    'require-deprecation-date': [
      2,
      {
        argumentName: 'deletionDate',
      },
    ],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
    'no-case-insensitive-enum-values-duplicates': [2],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [2],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'require-deprecation-reason': [2],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      2,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern: '^(User)',
        },
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      2,
      {
        exceptions: {
          types: ['PageInfo', 'Email', 'Phone', 'TimeZone', 'Subscriber', 'Customer'],
          suffixes: ['Payload', 'Connection', 'Edge', 'Error'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'no-hashtag-description': [2],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [2],
    'no-scalar-result-type-on-mutation': [2],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'require-description': [
      1,
      {
        EnumTypeDefinition: true,
      },
    ],
    'require-type-pattern-with-oneof': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition'],
        arguments: ['FieldDefinition'],
        definitions: true,
        values: ['EnumTypeDefinition'],
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'require-deprecation-date': [
      1,
      {
        argumentName: 'deletionDate',
      },
    ],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      2,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      2,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'no-typename-prefix': [1],
    'no-unreachable-types': [1],
    'relay-connection-types': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: {
          style: 'PascalCase',
          forbiddenSuffixes: ['Failure'],
        },
        Argument: {
          style: 'camelCase',
          forbiddenPrefixes: ['userUuid'],
          forbiddenSuffixes: ['UserId', 'userUuid'],
        },
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern: '^federation_',
        },
        InputValueDefinition: {
          style: 'camelCase',
          forbiddenSuffixes: ['UserId'],
        },
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['post', 'put', 'mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription', 'subscribe'],
          forbiddenSuffixes: ['Subscription'],
        },
        'FieldDefinition[parent.name.value=/.*(Error|Exception)/]': {
          forbiddenPrefixes: ['message'],
          forbiddenSuffixes: ['Message'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: [
            'MonetaryAmount',
            'PageInfo',
            'MarketReturn',
            'InvestmentCategory',
            'SecurityHeadline',
            'ETFPrice',
            'StatementLink',
            'Eligibility',
            'Image',
            'StringKeyAsset',
          ],
          suffixes: ['CurrencyAmount', 'Error', 'Exception', 'Failure'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'relay-connection-types': [1],
    'require-nullable-result-in-root': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        DirectiveDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'no-hashtag-description': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'strict-id-in-types': [
      1,
      {
        acceptedIdTypes: ['ID'],
        acceptedIdNames: ['id'],
      },
    ],
    'relay-connection-types': [1],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          suffixes: ['Filter', 'Connection'],
        },
        acceptedIdNames: ['id', 'identity'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-deprecation-reason': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['Field', 'FieldDefinition'],
        definitions: false,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: false,
        values: ['EnumTypeDefinition'],
      },
    ],
    'no-root-type': [
      1,
      {
        disallow: ['mutation', 'subscription'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'inline',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [1],
    'require-nullable-result-in-root': [1],
    'require-type-pattern-with-oneof': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'naming-convention': [
      1,
      {
        FieldDefinition: 'camelCase',
        InputValueDefinition: {
          style: 'camelCase',
        },
        ObjectTypeDefinition: {
          style: 'PascalCase',
        },
        InputObjectTypeDefinition: {
          style: 'PascalCase',
          requiredSuffixes: ['Input'],
        },
        'FieldDefinition[parent.name.value=Query]': {
          style: 'camelCase',
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          style: 'camelCase',
          forbiddenSuffixes: ['Mutation'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {},
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'require-description': [
      1,
      {
        OperationDefinition: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [
      1,
      {
        definitions: false,
        values: ['EnumTypeDefinition'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: false,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Type', 'type'],
          forbiddenSuffixes: ['Type', 'type'],
        },
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        EnumTypeDefinition: {
          forbiddenPrefixes: ['enum', 'Enum'],
          forbiddenSuffixes: ['enum', 'Enum'],
        },
        FragmentDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['Fragment'],
          forbiddenSuffixes: ['Fragment'],
        },
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        UnionTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['union', 'Union'],
          forbiddenSuffixes: ['union', 'Union'],
        },
        InputValueDefinition: 'camelCase',
        ObjectTypeDefinition: {
          forbiddenPrefixes: ['Type'],
          forbiddenSuffixes: ['Type'],
        },
        InterfaceTypeDefinition: {
          style: 'PascalCase',
          forbiddenPrefixes: ['interface', 'Interface'],
          forbiddenSuffixes: ['interface', 'Interface'],
        },
        InputObjectTypeDefinition: 'PascalCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          requiredPrefixes: ['create', 'update', 'delete', 'terminate', 'add', 'remove'],
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
  },
  {
    'no-unreachable-types': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        definitions: false,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition'],
        definitions: true,
        values: ['EnumTypeDefinition'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        allowLeadingUnderscore: true,
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'create', 'delete', 'get', 'is', 'remove', 'set', 'update'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: [
            'mutation',
            'create',
            'delete',
            'get',
            'is',
            'remove',
            'set',
            'update',
          ],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-description': [
      1,
      {
        rootField: true,
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        EnumTypeDefinition: true,
        EnumValueDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['Field', 'Directive', 'DirectiveDefinition', 'FieldDefinition'],
        definitions: true,
        values: ['EnumTypeDefinition'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [1],
    'require-nullable-result-in-root': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-description': [
      1,
      {
        types: true,
        DirectiveDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
      },
    ],
    'require-nullable-fields-with-oneof': [1],
  },
  {
    alphabetize: [
      1,
      {
        definitions: false,
      },
    ],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'relay-connection-types': [1],
  },
  {
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        EnumValueDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
  },
  {
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: ['Tag', 'Member', 'GeoPosition', 'Schedule'],
          suffixes: ['Filter', 'Connection', 'Metric', 'Metrics', 'Value'],
        },
        acceptedIdNames: ['id', 'identity', 'operationId'],
        acceptedIdTypes: ['ID'],
      },
    ],
  },
  {
    'no-root-type': [
      1,
      {
        disallow: ['subscription'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'no-root-type': [
      1,
      {
        disallow: ['subscription'],
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'PascalCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
  },
  {
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
  },
  {
    'input-name': [0],
    alphabetize: [0],
    'relay-arguments': [0],
    'relay-page-info': [0],
    'relay-edge-types': [0],
    'naming-convention': [0],
    'no-typename-prefix': [0],
    'no-hashtag-description': [0],
    'relay-connection-types': [0],
    'require-deprecation-reason': [0],
    'no-scalar-result-type-on-mutation': [0],
    'no-case-insensitive-enum-values-duplicates': [0],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'require-deprecation-reason': [1],
  },
  {
    'relay-page-info': [1],
    'no-unreachable-types': [1],
  },
  {
    'no-root-type': [
      1,
      {
        disallow: ['subscription'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'description-style': [
      1,
      {
        style: 'inline',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [1],
    'require-type-pattern-with-oneof': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition'],
        definitions: true,
        values: ['EnumTypeDefinition'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'create', 'delete', 'get', 'is', 'remove', 'set', 'update'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: [
            'mutation',
            'create',
            'delete',
            'get',
            'is',
            'remove',
            'set',
            'update',
          ],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-description': [
      1,
      {
        rootField: true,
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    alphabetize: [
      1,
      {
        fields: ['ObjectTypeDefinition', 'InterfaceTypeDefinition', 'InputObjectTypeDefinition'],
        arguments: ['FieldDefinition', 'Field', 'DirectiveDefinition', 'Directive'],
        definitions: true,
        values: ['EnumTypeDefinition'],
      },
    ],
    'no-root-type': [
      1,
      {
        disallow: ['mutation', 'subscription'],
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        FragmentDefinition: {
          style: 'PascalCase',
          suffix: 'Fields',
          requiredSuffixes: ['Fields'],
          forbiddenPrefixes: ['Fragment'],
          forbiddenSuffixes: ['Fragment'],
        },
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'EnumTypeDefinition,EnumTypeExtension': {
          forbiddenPrefixes: ['Enum'],
          forbiddenSuffixes: ['Enum'],
        },
        'UnionTypeDefinition,UnionTypeExtension': {
          forbiddenPrefixes: ['Union'],
          forbiddenSuffixes: ['Union'],
        },
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'ObjectTypeDefinition,ObjectTypeExtension': {
          forbiddenPrefixes: ['Type'],
          forbiddenSuffixes: ['Type'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'InterfaceTypeDefinition,InterfaceTypeExtension': {
          forbiddenPrefixes: ['Interface'],
          forbiddenSuffixes: ['Interface'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: ['Error'],
          suffixes: ['Payload'],
        },
        acceptedIdNames: ['id', '_id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-date': [
      1,
      {
        argumentName: 'deletionDate',
      },
    ],
    'require-deprecation-reason': [1],
    'require-type-pattern-with-oneof': [1],
    'no-scalar-result-type-on-mutation': [1],
    'require-nullable-fields-with-oneof': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
    'require-field-of-type-query-in-mutation-result': [1],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'no-unreachable-types': [1],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'no-root-type': [
      1,
      {
        disallow: ['mutation'],
      },
    ],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-deprecation-reason': [1],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-deprecation-date': [
      1,
      {
        argumentName: 'deletionDate',
      },
    ],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'no-unreachable-types': [0],
  },
  {
    'require-description': [
      1,
      {
        types: true,
        FieldDefinition: false,
        EnumTypeDefinition: false,
        DirectiveDefinition: false,
        OperationDefinition: false,
        InputValueDefinition: false,
        ScalarTypeDefinition: false,
        InputObjectTypeDefinition: false,
      },
    ],
    'require-deprecation-reason': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: false,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-reason': [1],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'PascalCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
  },
  {
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'description-style': [
      1,
      {
        style: 'block',
      },
    ],
    'naming-convention': [
      2,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        DirectiveDefinition: true,
        OperationDefinition: true,
        UnionTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        ScalarTypeDefinition: true,
        InterfaceTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: true,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'require-description': [
      1,
      {
        types: true,
        FieldDefinition: true,
        EnumTypeDefinition: true,
        InputValueDefinition: true,
        ObjectTypeDefinition: true,
        InputObjectTypeDefinition: true,
      },
    ],
    'relay-connection-types': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: false,
        caseSensitiveInputType: true,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: true,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: true,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        FieldDefinition: 'camelCase',
        allowLeadingUnderscore: true,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: ['Aggregate', 'PageInfo', 'Color', 'Location', 'RGBA', 'RichText'],
          suffixes: ['Connection', 'Edge'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get', 'list', 'fetch'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'require-description': [
      1,
      {
        types: true,
        rootField: true,
      },
    ],
    'no-unreachable-types': [1],
    'no-hashtag-description': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: false,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: {
          style: 'UPPER_CASE',
          ignorePattern:
            '^(SuperAdmin|ElephantAdmin|Owner|Manager|Salesperson|Client|User|Inactive)',
        },
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'strict-id-in-types': [
      1,
      {
        exceptions: {
          types: [
            'CalendarIntegration',
            'PageInfo',
            'SuperAdminScope',
            'WebDomain',
            'ProfileItems',
            'BotSettings',
            'EmailEntry',
            'PhoneEntry',
            'TimeZoneOption',
            'JSONSchema',
            'JSONSchemaType',
            'JSONSchemaObject',
            'JSONSchemaArray',
            'JSONSchemaString',
            'JSONSchemaNumber',
            'JSONSchemaBoolean',
            'JSONSchemaNull',
            'Position',
            'SeatTierCounts',
            'TranscriptSentence',
            'TranscriptTimelineEntry',
            'SpeakerDetail',
          ],
          suffixes: ['Payload', 'Connection', 'Edge', 'Error', 'ZoomConfig', 'Attendee'],
        },
        acceptedIdNames: ['id'],
        acceptedIdTypes: ['ID'],
      },
    ],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-date': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-unreachable-types': [1],
    'require-deprecation-reason': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
  {
    'input-name': [
      1,
      {
        checkQueries: false,
        checkInputType: true,
        checkMutations: true,
        caseSensitiveInputType: false,
      },
    ],
    alphabetize: [
      1,
      {
        definitions: false,
        values: ['EnumTypeDefinition'],
      },
    ],
    'relay-arguments': [
      1,
      {
        includeBoth: false,
      },
    ],
    'relay-page-info': [1],
    'relay-edge-types': [
      1,
      {
        withEdgeSuffix: true,
        shouldImplementNode: false,
        listTypeCanWrapOnlyEdgeType: true,
      },
    ],
    'naming-convention': [
      1,
      {
        types: 'PascalCase',
        Argument: 'camelCase',
        FieldDefinition: 'camelCase',
        DirectiveDefinition: 'camelCase',
        EnumValueDefinition: 'UPPER_CASE',
        InputValueDefinition: 'camelCase',
        'FieldDefinition[parent.name.value=Query]': {
          forbiddenPrefixes: ['query', 'get'],
          forbiddenSuffixes: ['Query'],
        },
        'FieldDefinition[parent.name.value=Mutation]': {
          forbiddenPrefixes: ['mutation'],
          forbiddenSuffixes: ['Mutation'],
        },
        'FieldDefinition[parent.name.value=Subscription]': {
          forbiddenPrefixes: ['subscription'],
          forbiddenSuffixes: ['Subscription'],
        },
        allowLeadingUnderscore: false,
        allowTrailingUnderscore: false,
      },
    ],
    'no-typename-prefix': [1],
    'no-hashtag-description': [1],
    'relay-connection-types': [1],
    'require-deprecation-reason': [1],
    'no-scalar-result-type-on-mutation': [1],
    'no-case-insensitive-enum-values-duplicates': [1],
  },
];
