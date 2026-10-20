// @vitest-environment jsdom
import type * as Urql from 'urql';
import { makeFragmentData } from '@/gql';
import { RuleInstanceSeverityLevel, type SchemaPolicyInput } from '@/gql/graphql';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PolicySettings, PolicySettings_SchemaPolicyFragment } from './policy-settings';
import * as editorStyles from './rules-configuration/naming-convention-rule-editor.css';

/** The stub the mocked urql query hook reads from. */
const urql = vi.hoisted(() => ({
  query: { data: undefined as unknown, fetching: false, error: undefined as unknown },
}));

vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof Urql>()),
  useQuery: () => [urql.query, vi.fn()],
}));

vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));

// The naming-convention rule edits its config in Monaco, which does not run in jsdom.
vi.mock('@/components/theme/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
  useMonacoTheme: () => 'vs',
}));
vi.mock('@monaco-editor/react', () => ({
  loader: { config: () => {} },
  default: (props: {
    defaultValue?: string;
    className?: string;
    onChange?: (value: string | undefined) => void;
  }) => (
    <textarea
      aria-label="Configuration JSON"
      className={props.className}
      defaultValue={props.defaultValue}
      onChange={event => props.onChange?.(event.target.value)}
    />
  ),
}));

/** Rules shaped like the policy service serves them: one config object wrapped in a tuple schema. */
const rules = [
  {
    id: 'require-deprecation-reason',
    description: 'Require all deprecation directives to specify a reason.',
    recommended: true,
    documentationUrl: null,
    configJsonSchema: null,
  },
  {
    id: 'input-name',
    description: 'Require mutation argument to always be called "input".',
    recommended: false,
    documentationUrl: 'https://example.com/rules/input-name',
    configJsonSchema: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          checkInputType: { type: 'boolean', default: false },
          caseSensitiveInputType: { type: 'boolean', default: true },
        },
      },
    },
  },
  {
    id: 'description-style',
    description: 'Require all comments to follow the same style.',
    recommended: true,
    documentationUrl: null,
    configJsonSchema: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: { style: { enum: ['block', 'inline'], default: 'block' } },
      },
    },
  },
  {
    id: 'require-deprecation-date',
    description: 'Require deletion date on @deprecated directive.',
    recommended: false,
    documentationUrl: null,
    configJsonSchema: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { argumentName: { type: 'string' } },
      },
    },
  },
  {
    id: 'naming-convention',
    description: 'Require names to follow specified conventions.',
    recommended: true,
    documentationUrl: null,
    configJsonSchema: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        properties: { types: { enum: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'] } },
      },
    },
  },
  {
    id: 'no-root-type',
    description: 'Disallow using root types mutation and/or subscription.',
    recommended: false,
    documentationUrl: null,
    configJsonSchema: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['disallow'],
        properties: {
          disallow: {
            type: 'array',
            uniqueItems: true,
            minItems: 1,
            items: { enum: ['mutation', 'subscription'] },
          },
        },
      },
    },
  },
  {
    id: 'strict-id-in-types',
    description: 'Requires output types to have one unique identifier.',
    recommended: true,
    documentationUrl: null,
    configJsonSchema: {
      type: 'array',
      maxItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          acceptedIdNames: {
            type: 'array',
            uniqueItems: true,
            minItems: 1,
            items: { type: 'string' },
            default: ['id'],
          },
          acceptedIdTypes: {
            type: 'array',
            uniqueItems: true,
            minItems: 1,
            items: { type: 'string' },
            default: ['ID'],
          },
          exceptions: {
            type: 'object',
            additionalProperties: false,
            properties: {
              types: { type: 'array', uniqueItems: true, minItems: 1, items: { type: 'string' } },
              suffixes: {
                type: 'array',
                uniqueItems: true,
                minItems: 1,
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
];

type Saved = {
  ruleId: string;
  severity: RuleInstanceSeverityLevel;
  configuration: unknown;
};

function policy(input: { allowOverrides?: boolean; rules?: Saved[] }) {
  return makeFragmentData(
    {
      __typename: 'SchemaPolicy' as const,
      id: 'policy-1',
      allowOverrides: input.allowOverrides ?? true,
      rules: (input.rules ?? []).map(rule => ({
        __typename: 'SchemaPolicyRuleInstance' as const,
        rule: { __typename: 'SchemaPolicyRule' as const, id: rule.ruleId },
        severity: rule.severity,
        configuration: rule.configuration,
      })),
    },
    PolicySettings_SchemaPolicyFragment,
  );
}

function renderSettings(props: {
  currentState?: ReturnType<typeof policy> | null;
  rulesInParent?: string[];
  error?: string;
  readOnly?: boolean;
  withAllowOverrides?: boolean;
}) {
  const onSave = vi.fn((_values: SchemaPolicyInput, _allowOverrides: boolean) => Promise.resolve());
  const element = (override: typeof props = props) => (
    <PolicySettings
      currentState={override.currentState}
      rulesInParent={override.rulesInParent}
      error={override.error}
      onSave={override.readOnly ? null : onSave}
    >
      {override.withAllowOverrides
        ? ({ allowOverrides, setAllowOverrides }) => (
            <label>
              <input
                type="checkbox"
                checked={allowOverrides}
                onChange={event => setAllowOverrides(event.target.checked)}
              />
              Allow projects to override or disable rules
            </label>
          )
        : undefined}
    </PolicySettings>
  );
  const view = render(element());
  return { ...view, element, onSave };
}

/** The base Checkbox labels a hidden input; the visible control is the sibling before it. */
const checkbox = (label: string) =>
  screen.getByLabelText(label, { selector: 'input' }).previousElementSibling as HTMLElement;
const ruleCheckbox = checkbox;
const ruleRow = (id: string) => document.querySelector(`[data-rule="${id}"]`) as HTMLElement;
const updateButton = () =>
  screen.getByRole('button', { name: 'Update Policy' }) as HTMLButtonElement;

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/** The react-select input of a list editor; nested properties keep their dotted name. */
const listInput = (rule: string, property: string) =>
  document.getElementById(`${rule}_${property}`) as HTMLInputElement;

async function keyDown(input: HTMLInputElement, key: string) {
  await act(async () => {
    fireEvent.keyDown(input, { key });
  });
}

/** Opens the list and takes its first option that is not already picked. */
async function pickFirstOption(input: HTMLInputElement) {
  await keyDown(input, 'ArrowDown');
  await keyDown(input, 'Enter');
}

async function createOption(input: HTMLInputElement, text: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value: text } });
  });
  await keyDown(input, 'Enter');
}

async function submit() {
  await waitFor(() => expect(updateButton().disabled).toBe(false));
  await click(updateButton());
}

beforeEach(() => {
  urql.query.data = { schemaPolicyRules: rules };
});

describe('PolicySettings', () => {
  it('lists every rule unchecked and has nothing to save', () => {
    renderSettings({ currentState: null });
    for (const rule of rules) {
      expect(ruleCheckbox(rule.id).getAttribute('aria-checked')).toBe('false');
    }
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    expect(updateButton().disabled).toBe(true);
  });

  it('enables a rule at warning severity with its default config and saves it', async () => {
    const { onSave, rerender, element } = renderSettings({ currentState: null });
    await click(ruleCheckbox('input-name'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Warning' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(checkbox('checkInputType').getAttribute('aria-checked')).toBe('false');
    expect(checkbox('caseSensitiveInputType').getAttribute('aria-checked')).toBe('true');

    await click(checkbox('checkInputType'));
    await submit();

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: Saved[] = [
      {
        ruleId: 'input-name',
        severity: RuleInstanceSeverityLevel.Warning,
        configuration: { checkInputType: true, caseSensitiveInputType: true },
      },
    ];
    expect(onSave.mock.calls[0]).toEqual([{ rules: saved }, true]);

    // The page refetches the policy after saving; the form picks the saved state up clean.
    rerender(element({ currentState: policy({ rules: saved }) }));
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    expect(ruleCheckbox('input-name').getAttribute('aria-checked')).toBe('true');
    expect(checkbox('checkInputType').getAttribute('aria-checked')).toBe('true');
    expect(updateButton().disabled).toBe(true);
  });

  it('saves the picked severity and enum choice, and no config for a rule without one', async () => {
    const { onSave } = renderSettings({ currentState: null });
    await click(ruleCheckbox('description-style'));
    await click(within(ruleRow('description-style')).getByRole('button', { name: 'Error' }));
    await click(within(ruleRow('description-style')).getByRole('button', { name: 'inline' }));
    await click(ruleCheckbox('require-deprecation-reason'));
    await submit();

    expect(onSave.mock.calls[0][0]).toEqual({
      rules: [
        {
          ruleId: 'description-style',
          severity: RuleInstanceSeverityLevel.Error,
          configuration: { style: 'inline' },
        },
        {
          ruleId: 'require-deprecation-reason',
          severity: RuleInstanceSeverityLevel.Warning,
          configuration: undefined,
        },
      ],
    });
  });

  it('starts on the saved policy and drops a rule that is unchecked', async () => {
    const { onSave } = renderSettings({
      currentState: policy({
        allowOverrides: false,
        rules: [
          {
            ruleId: 'require-deprecation-date',
            severity: RuleInstanceSeverityLevel.Error,
            configuration: { argumentName: 'until' },
          },
          {
            ruleId: 'description-style',
            severity: RuleInstanceSeverityLevel.Warning,
            configuration: { style: 'block' },
          },
        ],
      }),
    });
    expect(updateButton().disabled).toBe(true);
    expect(
      (document.getElementById('require-deprecation-date_argumentName') as HTMLInputElement).value,
    ).toBe('until');
    expect(
      within(ruleRow('require-deprecation-date'))
        .getByRole('button', { name: 'Error' })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    await click(ruleCheckbox('description-style'));
    await submit();

    expect(onSave.mock.calls[0]).toEqual([
      {
        rules: [
          {
            ruleId: 'require-deprecation-date',
            severity: RuleInstanceSeverityLevel.Error,
            configuration: { argumentName: 'until' },
          },
        ],
      },
      false,
    ]);
  });

  it('lets a project switch off a rule inherited from the organization', async () => {
    const { onSave } = renderSettings({
      currentState: policy({
        rules: [
          {
            ruleId: 'input-name',
            severity: RuleInstanceSeverityLevel.Warning,
            configuration: { checkInputType: false, caseSensitiveInputType: true },
          },
        ],
      }),
      rulesInParent: ['input-name'],
    });
    expect(
      screen.getByText(/You are overriding a rule configured at the organization level/),
    ).toBeTruthy();

    await click(
      screen.getByRole('button', { name: 'Disables a rule defined at the organization level' }),
    );
    expect(
      screen.getByText(/You are disabling a rule configured at the organization level/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('checkInputType', { selector: 'input' })).toBeNull();
    await submit();

    expect(onSave.mock.calls[0][0]).toEqual({
      rules: [
        { ruleId: 'input-name', severity: RuleInstanceSeverityLevel.Off, configuration: null },
      ],
    });
  });

  it('holds the save while the naming convention JSON is broken', async () => {
    const { onSave } = renderSettings({ currentState: null });
    await click(ruleCheckbox('naming-convention'));
    const editor = () => screen.getByLabelText('Configuration JSON') as HTMLTextAreaElement;
    expect(JSON.parse(editor().defaultValue).types).toBe('PascalCase');

    await act(async () => {
      fireEvent.change(editor(), { target: { value: '{"types":' } });
    });
    await waitFor(() =>
      expect(editor().className).toContain(editorStyles.namingConventionConfigEditorMonacoEditor2),
    );
    expect(updateButton().disabled).toBe(true);

    // Configs are checked against the rule's JSON Schema by the policy service on save, not here.
    await act(async () => {
      fireEvent.change(editor(), { target: { value: '{"types":"snake_case"}' } });
    });
    await submit();
    expect(onSave.mock.calls[0][0]).toEqual({
      rules: [
        {
          ruleId: 'naming-convention',
          severity: RuleInstanceSeverityLevel.Warning,
          configuration: { types: 'snake_case' },
        },
      ],
    });
  });

  it('accepts every saved config shape and sends them back untouched', async () => {
    const saved: Saved[] = [
      {
        ruleId: 'require-deprecation-reason',
        severity: RuleInstanceSeverityLevel.Warning,
        configuration: null,
      },
      { ruleId: 'input-name', severity: RuleInstanceSeverityLevel.Off, configuration: null },
      {
        ruleId: 'no-root-type',
        severity: RuleInstanceSeverityLevel.Error,
        configuration: { disallow: ['mutation'] },
      },
      {
        ruleId: 'strict-id-in-types',
        severity: RuleInstanceSeverityLevel.Warning,
        configuration: {
          acceptedIdNames: ['id'],
          acceptedIdTypes: ['ID'],
          exceptions: { types: ['Node'] },
        },
      },
    ];
    const { onSave } = renderSettings({
      currentState: policy({ rules: saved }),
      rulesInParent: ['input-name'],
    });
    await act(async () => {});
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    expect(updateButton().disabled).toBe(true);

    await pickFirstOption(listInput('no-root-type', 'disallow'));
    await submit();

    expect(onSave.mock.calls[0][0]).toEqual({
      rules: [
        saved[0],
        saved[1],
        { ...saved[2], configuration: { disallow: ['mutation', 'subscription'] } },
        saved[3],
      ],
    });
  });

  it('seeds list defaults, then adds, clears and nests values', async () => {
    const { onSave } = renderSettings({ currentState: null });
    await click(ruleCheckbox('strict-id-in-types'));
    expect(screen.getByText('id')).toBeTruthy();
    expect(screen.getByText('ID')).toBeTruthy();

    await createOption(listInput('strict-id-in-types', 'acceptedIdNames'), 'uuid');
    await createOption(listInput('strict-id-in-types', 'exceptions.types'), 'Node');
    await click(screen.getByRole('button', { name: 'Remove ID' }));
    await submit();

    const [rule] = onSave.mock.calls[0][0].rules;
    const configuration = rule.configuration as { acceptedIdTypes?: unknown };
    expect(configuration).toEqual({
      acceptedIdNames: ['id', 'uuid'],
      exceptions: { types: ['Node'] },
    });
    // An emptied list is dropped rather than sent as [], which the rule schema would refuse.
    expect(configuration.acceptedIdTypes).toBeUndefined();
  });

  it('keeps a rule as it was through uncheck and recheck, and saves an edited value', async () => {
    const { onSave } = renderSettings({
      currentState: policy({
        rules: [
          {
            ruleId: 'require-deprecation-date',
            severity: RuleInstanceSeverityLevel.Error,
            configuration: { argumentName: 'until' },
          },
        ],
      }),
    });
    const input = () =>
      document.getElementById('require-deprecation-date_argumentName') as HTMLInputElement;

    await click(ruleCheckbox('require-deprecation-date'));
    expect(input()).toBeNull();
    await click(ruleCheckbox('require-deprecation-date'));
    expect(
      within(ruleRow('require-deprecation-date'))
        .getByRole('button', { name: 'Error' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(input().value).toBe('until');

    await act(async () => {
      fireEvent.change(input(), { target: { value: 'deletedAt' } });
    });
    await submit();

    expect(onSave.mock.calls[0][0]).toEqual({
      rules: [
        {
          ruleId: 'require-deprecation-date',
          severity: RuleInstanceSeverityLevel.Error,
          configuration: { argumentName: 'deletedAt' },
        },
      ],
    });
  });

  it('passes the override toggle through to the save', async () => {
    const { onSave } = renderSettings({ currentState: null, withAllowOverrides: true });
    await click(ruleCheckbox('require-deprecation-reason'));
    await click(screen.getByLabelText('Allow projects to override or disable rules'));
    await submit();
    expect(onSave.mock.calls[0][1]).toBe(false);
  });

  it('is inert without permission to save and shows the last failure', () => {
    renderSettings({ currentState: null, readOnly: true, error: 'Policy rejected' });
    expect(screen.getByText('You have read only access to this policy.')).toBeTruthy();
    expect(ruleCheckbox('input-name').getAttribute('aria-disabled')).toBe('true');
    expect(updateButton().disabled).toBe(true);
    expect(screen.getByText('Oops, something went wrong.')).toBeTruthy();
    expect(screen.getByText('Policy rejected')).toBeTruthy();
  });
});
