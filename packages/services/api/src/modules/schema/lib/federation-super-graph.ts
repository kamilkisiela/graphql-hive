import {
  type ConstArgumentNode,
  type ConstDirectiveNode,
  type DocumentNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  Kind,
  type NameNode,
  visit,
} from 'graphql';

type SuperGraphInformation = {
  /** Mapping of schema coordinate to the services that own it. */
  schemaCoordinateServicesMappings: Map<string, Set<string>>;
};

/**
 * Extracts the super graph information from the GraphQL schema AST.
 */
export function extractSuperGraphInformation(documentAst: DocumentNode): SuperGraphInformation {
  const schemaCoordinateServiceMappings = new Map<string, Set<string>>();

  const serviceEnumValueToServiceNameMappings = new Map<string, string>();
  const schemaCoordinateToServiceEnumValueMappings = new Map<string, Set<string>>();

  function interfaceAndObjectHandler(node: {
    readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
    readonly directives?: ReadonlyArray<ConstDirectiveNode> | undefined;
    readonly name: NameNode;
  }) {
    const objectTypeServiceReferences = new Set(
      getJoinTypeEnumServiceName({
        directives: node.directives ?? [],
        valueName: 'type',
      }),
    );

    schemaCoordinateToServiceEnumValueMappings.set(node.name.value, objectTypeServiceReferences);

    if (node.fields === undefined) {
      return;
    }

    for (const fieldNode of node.fields) {
      const schemaCoordinate = `${node.name.value}.${fieldNode.name.value}`;

      const graphArg = fieldNode.directives
        ?.find(directive => directive.name.value === 'join__field')
        ?.arguments?.find(arg => arg.name.value === 'graph');

      if (graphArg === undefined) {
        schemaCoordinateToServiceEnumValueMappings.set(
          schemaCoordinate,
          objectTypeServiceReferences,
        );
        continue;
      }

      const serviceEnumValue = getEnumValueArgumentValue(graphArg);

      if (!serviceEnumValue) {
        continue;
      }

      schemaCoordinateToServiceEnumValueMappings.set(schemaCoordinate, new Set([serviceEnumValue]));
    }

    return false;
  }

  visit(documentAst, {
    /** Collect the service enum to service name mappings. */
    EnumTypeDefinition(node) {
      if (node.name.value === 'join__Graph' && node.values?.length) {
        for (const enumValueNode of node.values) {
          const serviceName = getJoinGraphEnumServiceName(enumValueNode);
          if (serviceName === null) {
            continue;
          }

          serviceEnumValueToServiceNameMappings.set(enumValueNode.name.value, serviceName);
        }
      }

      const enumServiceNames = getJoinTypeEnumServiceName({
        directives: node.directives ?? [],
        valueName: 'type',
      });

      if (enumServiceNames.size) {
        schemaCoordinateToServiceEnumValueMappings.set(node.name.value, enumServiceNames);
      }

      if (node.values?.length) {
        for (const enumValueNode of node.values) {
          const enumValueServiceNames = getJoinTypeEnumServiceName({
            directives: enumValueNode.directives ?? [],
            valueName: 'enumValue',
          });

          if (enumValueServiceNames.size) {
            const schemaCoordinate = `${node.name.value}.${enumValueNode.name.value}`;
            schemaCoordinateToServiceEnumValueMappings.set(schemaCoordinate, enumValueServiceNames);
          }
        }
      }

      return false;
    },
    ObjectTypeDefinition(node) {
      return interfaceAndObjectHandler(node);
    },
    InterfaceTypeDefinition(node) {
      return interfaceAndObjectHandler(node);
    },
  });

  for (const [schemaCoordinate, serviceEnumValues] of schemaCoordinateToServiceEnumValueMappings) {
    const serviceNames = new Set<string>();
    for (const serviceEnumValue of serviceEnumValues) {
      const serviceName = serviceEnumValueToServiceNameMappings.get(serviceEnumValue);
      if (serviceName) {
        serviceNames.add(serviceName);
      }
    }

    if (!serviceNames.size) {
      continue;
    }

    schemaCoordinateServiceMappings.set(schemaCoordinate, new Set(serviceNames));
  }

  return { schemaCoordinateServicesMappings: schemaCoordinateServiceMappings };
}

function getJoinGraphEnumServiceName(enumValueDefinitionNode: EnumValueDefinitionNode) {
  const arg = enumValueDefinitionNode.directives
    ?.find(directive => directive.name.value === 'join__graph')
    ?.arguments?.find(argument => argument.name.value === 'name');
  if (arg === undefined) {
    return null;
  }
  return getStringValueArgumentValue(arg);
}

function getJoinTypeEnumServiceName(args: {
  directives: ReadonlyArray<ConstDirectiveNode>;
  valueName: 'enumValue' | 'type';
}) {
  if (!args.directives?.length) {
    return new Set<string>();
  }
  const enumServiceValues = new Set<string>();
  for (const directiveNode of args.directives) {
    if (directiveNode.name.value !== `join__${args.valueName}`) {
      continue;
    }

    const nameArgNode = directiveNode.arguments?.find(argument => argument.name.value === 'graph');

    if (nameArgNode === undefined) {
      continue;
    }

    const enumServiceValue = getEnumValueArgumentValue(nameArgNode);

    if (enumServiceValue === null) {
      continue;
    }

    enumServiceValues.add(enumServiceValue);
  }

  return enumServiceValues;
}

function getEnumValueArgumentValue(arg: ConstArgumentNode): string | null {
  if (arg.value.kind !== Kind.ENUM) {
    return null;
  }

  return arg.value.value;
}

function getStringValueArgumentValue(arg: ConstArgumentNode): string | null {
  if (arg.value.kind !== Kind.STRING) {
    return null;
  }

  return arg.value.value;
}
