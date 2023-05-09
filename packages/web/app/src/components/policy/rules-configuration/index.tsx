import { ReactElement } from 'react';
import type { JSONSchema } from 'json-schema-typed';
import convertToYup from 'json-schema-yup-transformer';
import * as Yup from 'yup';
import { DocsLink } from '@/components/v2';
import { Markdown } from '@/components/v2/markdown';
import { RuleInstanceSeverityLevel } from '@/graphql';
import type { AvailableRulesList } from '../policy-settings';
import { PolicyBooleanToggle } from './boolean-config';
import { PolicyEnumSelect } from './enum-config';
import { PolicyMultiSelect } from './multiselect-config';
import { NamingConventionConfigEditor } from './naming-convention-rule-editor';
import { PolicyStringInputConfig } from './string-config';

export type PolicyFormValues = {
  allowOverrides: boolean;
  rules: Record<string, { enabled: boolean; severity: RuleInstanceSeverityLevel; config: unknown }>;
};

function composeTooltipContent(input: {
  description?: string;
  documentationUrl?: string;
}): undefined | ReactElement {
  const elements = [
    input.description ? (
      <Markdown key="docs" className="text-sm" content={input.description} />
    ) : null,
    input.documentationUrl ? (
      <DocsLink key="link" href={input.documentationUrl}>
        read more
      </DocsLink>
    ) : null,
  ].filter(Boolean);

  if (elements.length === 0) {
    return undefined;
  }

  return <>{elements}</>;
}

function composeDocsLink(
  baseUrl: string,
  propertyName: string,
  schema: JSONSchema,
): string | undefined {
  const attributes: string[] = [];

  if (typeof schema === 'object') {
    if (schema.enum) {
      attributes.push('enum');
    } else if (schema.type) {
      attributes.push(String(schema.type));
    }

    if (schema.required || schema.minItems) {
      attributes.push('required');
    }
  }

  return attributes.length === 0
    ? undefined
    : `${baseUrl}#${[propertyName.toLowerCase(), ...attributes].join('-')}`;
}

export function buildValidationSchema(availableRules: AvailableRulesList) {
  return Yup.object().shape(
    availableRules.reduce((acc, rule) => {
      return {
        ...acc,
        [rule.id]: Yup.object()
          .shape({
            severity: Yup.mixed()
              .oneOf([
                RuleInstanceSeverityLevel.Off,
                RuleInstanceSeverityLevel.Warning,
                RuleInstanceSeverityLevel.Error,
              ])
              .required(),
            config: rule.configJsonSchema
              ? convertToYup(rule.configJsonSchema as object)!
              : Yup.object().nullable(),
          })
          .optional()
          .default(undefined),
      };
    }, {}),
  );
}

export function PolicyRuleConfig({
  rule,
  basePropertyName = '',
  configJsonSchema,
  baseDocumentationUrl,
}: {
  rule: string;
  configJsonSchema: JSONSchema | null;
  basePropertyName?: string;
  baseDocumentationUrl?: string;
}): ReactElement | null {
  if (rule === 'naming-convention') {
    return <NamingConventionConfigEditor configJsonSchema={configJsonSchema} />;
  }

  if (
    configJsonSchema &&
    typeof configJsonSchema === 'object' &&
    configJsonSchema.type === 'object'
  ) {
    const configProperties = configJsonSchema.properties;

    if (configProperties && Object.keys(configProperties).length > 0) {
      return (
        <>
          {Object.entries(configProperties).map(([flatPropName, propertySchema]) => {
            const propertyName = basePropertyName
              ? `${basePropertyName}.${flatPropName}`
              : flatPropName;

            if (typeof propertySchema === 'object') {
              const documentationUrl = baseDocumentationUrl
                ? composeDocsLink(baseDocumentationUrl, propertyName, propertySchema)
                : undefined;

              if (propertySchema.type === 'array' && typeof propertySchema.items === 'object') {
                if (propertySchema.items.enum) {
                  return (
                    <PolicyMultiSelect
                      key={propertyName}
                      title={propertyName}
                      rule={rule}
                      defaultValues={propertySchema.default}
                      propertyName={propertyName}
                      tooltip={composeTooltipContent({
                        description: propertySchema.description,
                        documentationUrl,
                      })}
                      options={propertySchema.items.enum.map((v: string) => ({
                        label: v,
                        value: v,
                      }))}
                    />
                  );
                }

                return (
                  <PolicyMultiSelect
                    key={propertyName}
                    title={propertyName}
                    rule={rule}
                    defaultValues={propertySchema.default}
                    propertyName={propertyName}
                    tooltip={composeTooltipContent({
                      description: propertySchema.description,
                      documentationUrl,
                    })}
                    options={
                      propertySchema.default?.map((v: string) => ({ label: v, value: v })) || []
                    }
                    creatable
                  />
                );
              }

              if (propertySchema.type === 'object') {
                return (
                  <PolicyRuleConfig
                    rule={rule}
                    basePropertyName={propertyName}
                    key={propertyName}
                    baseDocumentationUrl={baseDocumentationUrl}
                    configJsonSchema={propertySchema}
                  />
                );
              }

              if (propertySchema.type === 'boolean') {
                return (
                  <PolicyBooleanToggle
                    key={propertyName}
                    rule={rule}
                    defaultValue={propertySchema.default}
                    propertyName={propertyName}
                    title={propertyName}
                    tooltip={composeTooltipContent({
                      description: propertySchema.description,
                      documentationUrl,
                    })}
                  />
                );
              }

              if (propertySchema.type === 'string') {
                return (
                  <PolicyStringInputConfig
                    key={propertyName}
                    rule={rule}
                    defaultValue={propertySchema.default}
                    propertyName={propertyName}
                    title={propertyName}
                    tooltip={composeTooltipContent({
                      description: propertySchema.description,
                      documentationUrl,
                    })}
                  />
                );
              }

              if (propertySchema.enum) {
                return (
                  <PolicyEnumSelect
                    key={propertyName}
                    title={propertyName}
                    rule={rule}
                    defaultValue={propertySchema.default}
                    propertyName={propertyName}
                    tooltip={composeTooltipContent({
                      description: propertySchema.description,
                      documentationUrl,
                    })}
                    options={propertySchema.enum.map(v => ({ label: v, value: v }))}
                  />
                );
              }
            }

            console.warn(`Unsupported property type: ${propertyName}`, propertySchema);

            return null;
          })}
        </>
      );
    }
  }

  return null;
}
