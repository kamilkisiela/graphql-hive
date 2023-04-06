import {
  buildUnionMemberAddedMessageFromMeta,
  Change,
  ChangeType,
  CriticalityLevel,
  directiveAddedFromMeta,
  directiveArgumentAddedFromMeta,
  directiveArgumentDefaultValueChangedFromMeta,
  directiveArgumentDescriptionChangedFromMeta,
  directiveArgumentRemovedFromMeta,
  directiveArgumentTypeChangedFromMeta,
  directiveDescriptionChangedFromMeta,
  directiveLocationAddedFromMeta,
  directiveLocationRemovedFromMeta,
  directiveRemovedFromMeta,
  enumValueAddedFromMeta,
  enumValueDeprecationReasonAddedFromMeta,
  enumValueDeprecationReasonChangedFromMeta,
  enumValueDeprecationReasonRemovedFromMeta,
  enumValueDescriptionChangedFromMeta,
  enumValueRemovedFromMeta,
  fieldAddedFromMeta,
  fieldArgumentAddedFromMeta,
  fieldArgumentDefaultChangedFromMeta,
  fieldArgumentDescriptionChangedFromMeta,
  fieldArgumentRemovedFromMeta,
  fieldArgumentTypeChangedFromMeta,
  fieldDeprecationAddedFromMeta,
  fieldDeprecationReasonAddedFromMeta,
  fieldDeprecationReasonChangedFromMeta,
  fieldDeprecationReasonRemovedFromMeta,
  fieldDeprecationRemovedFromMeta,
  fieldDescriptionAddedFromMeta,
  fieldDescriptionChangedFromMeta,
  fieldDescriptionRemovedFromMeta,
  fieldRemovedFromMeta,
  fieldTypeChangedFromMeta,
  inputFieldAddedFromMeta,
  inputFieldDefaultValueChangedFromMeta,
  inputFieldDescriptionAddedFromMeta,
  inputFieldDescriptionChangedFromMeta,
  inputFieldDescriptionRemovedFromMeta,
  inputFieldRemovedFromMeta,
  inputFieldTypeChangedFromMeta,
  objectTypeInterfaceAddedFromMeta,
  objectTypeInterfaceRemovedFromMeta,
  schemaMutationTypeChangedFromMeta,
  schemaQueryTypeChangedFromMeta,
  schemaSubscriptionTypeChangedFromMeta,
  SerializableChange as SerializableChangeBase,
  typeAddedFromMeta,
  typeDescriptionAddedFromMeta,
  typeDescriptionChangedFromMeta,
  typeDescriptionRemovedFromMeta,
  typeKindChangedFromMeta,
  typeRemovedFromMeta,
  unionMemberRemovedFromMeta,
} from '@graphql-inspector/core';

export type RegistryServiceUrlChangeSerializableChange = {
  type: 'REGISTRY_SERVICE_URL_CHANGED';
  meta: {
    serviceName: string;
    serviceUrls:
      | {
          old: null;
          new: string;
        }
      | {
          old: string;
          new: string;
        }
      | {
          old: string;
          new: null;
        };
  };
};

export type SerializableChange = (
  | RegistryServiceUrlChangeSerializableChange
  | SerializableChangeBase
) & {
  isSafeBasedOnUsage: boolean;
};

export type RegistryServiceUrlChangeChange = RegistryServiceUrlChangeSerializableChange & {
  message: string;
  criticality: Change['criticality'];
  path?: string;
};

/**
 * Create the schema change from the persisted meta data.
 */
function schemaChangeFromSerializableChange(change: SerializableChange): Change {
  switch (change.type) {
    case ChangeType.FieldArgumentDescriptionChanged:
      return fieldArgumentDescriptionChangedFromMeta(change);
    case ChangeType.FieldArgumentDefaultChanged:
      return fieldArgumentDefaultChangedFromMeta(change);
    case ChangeType.FieldArgumentTypeChanged:
      return fieldArgumentTypeChangedFromMeta(change);
    case ChangeType.DirectiveRemoved:
      return directiveRemovedFromMeta(change);
    case ChangeType.DirectiveAdded:
      return directiveAddedFromMeta(change);
    case ChangeType.DirectiveDescriptionChanged:
      return directiveDescriptionChangedFromMeta(change);
    case ChangeType.DirectiveLocationAdded:
      return directiveLocationAddedFromMeta(change);
    case ChangeType.DirectiveLocationRemoved:
      return directiveLocationRemovedFromMeta(change);
    case ChangeType.DirectiveArgumentAdded:
      return directiveArgumentAddedFromMeta(change);
    case ChangeType.DirectiveArgumentRemoved:
      return directiveArgumentRemovedFromMeta(change);
    case ChangeType.DirectiveArgumentDescriptionChanged:
      return directiveArgumentDescriptionChangedFromMeta(change);
    case ChangeType.DirectiveArgumentDefaultValueChanged:
      return directiveArgumentDefaultValueChangedFromMeta(change);
    case ChangeType.DirectiveArgumentTypeChanged:
      return directiveArgumentTypeChangedFromMeta(change);
    case ChangeType.EnumValueRemoved:
      return enumValueRemovedFromMeta(change);
    case ChangeType.EnumValueAdded:
      return enumValueAddedFromMeta(change);
    case ChangeType.EnumValueDescriptionChanged:
      return enumValueDescriptionChangedFromMeta(change);
    case ChangeType.EnumValueDeprecationReasonChanged:
      return enumValueDeprecationReasonChangedFromMeta(change);
    case ChangeType.EnumValueDeprecationReasonAdded:
      return enumValueDeprecationReasonAddedFromMeta(change);
    case ChangeType.EnumValueDeprecationReasonRemoved:
      return enumValueDeprecationReasonRemovedFromMeta(change);
    case ChangeType.FieldRemoved:
      return fieldRemovedFromMeta(change);
    case ChangeType.FieldAdded:
      return fieldAddedFromMeta(change);
    case ChangeType.FieldDescriptionChanged:
      return fieldDescriptionChangedFromMeta(change);
    case ChangeType.FieldDescriptionAdded:
      return fieldDescriptionAddedFromMeta(change);
    case ChangeType.FieldDescriptionRemoved:
      return fieldDescriptionRemovedFromMeta(change);
    case ChangeType.FieldDeprecationAdded:
      return fieldDeprecationAddedFromMeta(change);
    case ChangeType.FieldDeprecationRemoved:
      return fieldDeprecationRemovedFromMeta(change);
    case ChangeType.FieldDeprecationReasonChanged:
      return fieldDeprecationReasonChangedFromMeta(change);
    case ChangeType.FieldDeprecationReasonAdded:
      return fieldDeprecationReasonAddedFromMeta(change);
    case ChangeType.FieldDeprecationReasonRemoved:
      return fieldDeprecationReasonRemovedFromMeta(change);
    case ChangeType.FieldTypeChanged:
      return fieldTypeChangedFromMeta(change);
    case ChangeType.FieldArgumentAdded:
      return fieldArgumentAddedFromMeta(change);
    case ChangeType.FieldArgumentRemoved:
      return fieldArgumentRemovedFromMeta(change);
    case ChangeType.InputFieldRemoved:
      return inputFieldRemovedFromMeta(change);
    case ChangeType.InputFieldAdded:
      return inputFieldAddedFromMeta(change);
    case ChangeType.InputFieldDescriptionAdded:
      return inputFieldDescriptionAddedFromMeta(change);
    case ChangeType.InputFieldDescriptionRemoved:
      return inputFieldDescriptionRemovedFromMeta(change);
    case ChangeType.InputFieldDescriptionChanged:
      return inputFieldDescriptionChangedFromMeta(change);
    case ChangeType.InputFieldDefaultValueChanged:
      return inputFieldDefaultValueChangedFromMeta(change);
    case ChangeType.InputFieldTypeChanged:
      return inputFieldTypeChangedFromMeta(change);
    case ChangeType.ObjectTypeInterfaceAdded:
      return objectTypeInterfaceAddedFromMeta(change);
    case ChangeType.ObjectTypeInterfaceRemoved:
      return objectTypeInterfaceRemovedFromMeta(change);
    case ChangeType.SchemaQueryTypeChanged:
      return schemaQueryTypeChangedFromMeta(change);
    case ChangeType.SchemaMutationTypeChanged:
      return schemaMutationTypeChangedFromMeta(change);
    case ChangeType.SchemaSubscriptionTypeChanged:
      return schemaSubscriptionTypeChangedFromMeta(change);
    case ChangeType.TypeRemoved:
      return typeRemovedFromMeta(change);
    case ChangeType.TypeAdded:
      return typeAddedFromMeta(change);
    case ChangeType.TypeKindChanged:
      return typeKindChangedFromMeta(change);
    case ChangeType.TypeDescriptionChanged:
      return typeDescriptionChangedFromMeta(change);
    case ChangeType.TypeDescriptionRemoved:
      return typeDescriptionRemovedFromMeta(change);
    case ChangeType.TypeDescriptionAdded:
      return typeDescriptionAddedFromMeta(change);
    case ChangeType.UnionMemberRemoved:
      return unionMemberRemovedFromMeta(change);
    case ChangeType.UnionMemberAdded:
      return buildUnionMemberAddedMessageFromMeta(change);
    case 'REGISTRY_SERVICE_URL_CHANGED':
      return buildRegistryServiceURLFromMeta(change);
  }
}

function buildRegistryServiceURLFromMeta(
  change: RegistryServiceUrlChangeSerializableChange,
): RegistryServiceUrlChangeChange {
  return {
    type: 'REGISTRY_SERVICE_URL_CHANGED',
    message: change.meta.serviceUrls.old
      ? `[${change.meta.serviceName}] New service url: '${
          change.meta.serviceUrls.new
        }' (previously: '${change.meta.serviceUrls.old ?? 'none'}')`
      : `[${change.meta.serviceName}] Service url removed (previously: '${
          change.meta.serviceUrls.old ?? 'none'
        }'`,
    criticality: {
      level: CriticalityLevel.Dangerous,
      reason: 'The registry service url has changed',
    },
    meta: change.meta,
  } as const;
}

export function schemaChangeFromMeta(serializableChange: SerializableChange): Change {
  const change = schemaChangeFromSerializableChange(serializableChange);

  // see https://github.com/kamilkisiela/graphql-inspector/blob/3f5d7291d730119c926a05d165aa2f4a309e4fbd/packages/core/src/diff/rules/consider-usage.ts#L71-L78
  if (serializableChange.isSafeBasedOnUsage) {
    return {
      ...change,
      criticality: {
        ...change.criticality,
        level: CriticalityLevel.Dangerous,
        isSafeBasedOnUsage: true,
      },
      message: `${change.message} (non-breaking based on usage)`,
    };
  }

  return change;
}
