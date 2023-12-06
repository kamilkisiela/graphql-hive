import { ReactElement, useEffect } from 'react';
import type { JSONSchema } from 'json-schema-typed';
import { Spinner } from '@/components/v2';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { useConfigurationHelper } from '../form-helper';

const DEFAULT_VALUE = {
  types: 'PascalCase',
  FieldDefinition: 'camelCase',
  InputValueDefinition: 'camelCase',
  Argument: 'camelCase',
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
};

export function NamingConventionConfigEditor(props: {
  configJsonSchema: JSONSchema | null;
}): ReactElement {
  const { config, setConfig, getConfigValue, setConfigAsInvalid } =
    useConfigurationHelper().ruleConfig('naming-convention');
  const currentValue = getConfigValue<string | undefined>('');

  useEffect(() => {
    if (!config) {
      setConfig('', DEFAULT_VALUE);
    }
  }, []);

  function handleEditorWillMount(monaco: Monaco) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      allowComments: false,
      comments: 'error',
      enableSchemaRequest: false,
      schemaValidation: 'error',
      trailingCommas: 'error',
      validate: true,
      schemaRequest: 'ignore',
      schemas: [
        {
          uri: 'https://example.com/naming-convention-schema.json',
          fileMatch: ['*'],
          schema: props.configJsonSchema,
        },
      ],
    });
  }

  return (
    <div className="col-span-4">
      <MonacoEditor
        theme="vs-dark"
        loading={<Spinner />}
        height="40vh"
        beforeMount={handleEditorWillMount}
        width="100%"
        language="json"
        onChange={value => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(value as string);
          } catch (error) {
            setConfigAsInvalid('', error instanceof Error ? error.message : String(error));
          }

          if (typeof parsed !== 'undefined') {
            setConfig('', parsed);
          }
        }}
        options={{
          lineNumbers: 'off',
        }}
        defaultValue={JSON.stringify(currentValue, null, 2)}
      />
    </div>
  );
}
