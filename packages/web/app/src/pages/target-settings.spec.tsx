// @vitest-environment jsdom
import type { ReactNode } from 'react';
import type * as Urql from 'urql';
import type { SchemaEditorProps } from '@/components/schema-editor';
import { ToastProvider } from '@/components/ui/primitives/toast/toast';
import { DangerousChangeType } from '@/gql/graphql';
import type * as Router from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AppDeploymentProtection,
  BreakingChanges,
  DangerousChangeTypeForm,
  GraphQLEndpointUrl,
  TargetSettingsBaseSchemaSection,
} from './target-settings';

/** The stubs the mocked urql hooks read from; each test resets them. */
const urql = vi.hoisted(() => ({
  query: { data: undefined as unknown, fetching: false, error: undefined as unknown },
  mutation: { data: undefined as unknown, fetching: false, error: undefined as unknown },
  mutate: vi.fn(),
}));

/** Records what the mocked schema editor was rendered with. */
const schemaEditor = vi.hoisted(() => ({ props: undefined as SchemaEditorProps | undefined }));

vi.mock('urql', async importOriginal => ({
  ...(await importOriginal<typeof Urql>()),
  useQuery: () => [urql.query, vi.fn()],
  useMutation: () => [urql.mutation, urql.mutate],
}));

// The page resolves docs links and the app origin through the env, which jsdom does not carry.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));

// The page also mounts the Monaco editor and router links, neither of which runs in jsdom.
vi.mock('@/components/schema-editor', () => ({
  SchemaEditor: (props: SchemaEditorProps) => {
    schemaEditor.props = props;
    return null;
  },
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...(await importOriginal<typeof Router>()),
  Link: (props: { children?: ReactNode }) => <a href="#">{props.children}</a>,
  useRouter: () => ({ navigate: vi.fn() }),
}));

const selector = { organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'production' };

// These sections read the current target from the URL; here they render outside a router.
vi.mock('@/lib/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/hooks')>()),
  useSlugs: () => selector,
}));

describe('GraphQLEndpointUrl', () => {
  function renderForm(graphqlEndpointUrl: string | null) {
    // A fresh element each time, or React skips the update and never reads the mutation state.
    const element = () => (
      <ToastProvider>
        <GraphQLEndpointUrl graphqlEndpointUrl={graphqlEndpointUrl} {...selector} />
      </ToastProvider>
    );
    const view = render(element());
    return { ...view, element };
  }

  const urlInput = () => screen.getByPlaceholderText('Endpoint Url') as HTMLInputElement;
  const save = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

  async function type(value: string) {
    await act(async () => {
      fireEvent.change(urlInput(), { target: { value } });
      fireEvent.blur(urlInput());
    });
  }

  beforeEach(() => {
    urql.mutation.data = undefined;
    urql.mutate.mockReset();
  });

  it('starts on the saved endpoint and refuses anything that is not a URL', async () => {
    renderForm('https://api.example.com/graphql');
    expect(urlInput().value).toBe('https://api.example.com/graphql');
    expect(urlInput().getAttribute('name')).toBe('graphqlEndpointUrl');
    await type('nope');
    expect(screen.getByText('Please enter a valid url.')).toBeTruthy();
    await save();
    expect(urql.mutate).not.toHaveBeenCalled();
  });

  it('saves the endpoint for the target and confirms', async () => {
    urql.mutate.mockResolvedValue({
      data: {
        updateTargetGraphQLEndpointUrl: {
          ok: { target: { id: 't-1', graphqlEndpointUrl: 'https://api.example.com/v2' } },
          error: null,
        },
      },
    });
    renderForm(null);
    await type('https://api.example.com/v2');
    await save();
    expect(urql.mutate).toHaveBeenCalledTimes(1);
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      input: { target: { bySelector: selector }, graphqlEndpointUrl: 'https://api.example.com/v2' },
    });
    expect(
      (await screen.findAllByText('GraphQL endpoint url updated successfully')).length,
    ).toBeGreaterThan(0);
  });

  it('reports a refused endpoint', async () => {
    const result = {
      data: {
        updateTargetGraphQLEndpointUrl: { ok: null, error: { message: 'Endpoint unreachable' } },
      },
    };
    urql.mutate.mockResolvedValue(result);
    const { rerender, element } = renderForm(null);
    await type('https://api.example.com/v2');
    await save();
    urql.mutation.data = result.data;
    rerender(element());
    expect((await screen.findAllByText('Endpoint unreachable')).length).toBeGreaterThan(0);
  });
});

describe('TargetSettingsBaseSchemaSection', () => {
  const syntaxError = {
    startLineNumber: 1,
    startColumn: 24,
    endLineNumber: 1,
    endColumn: 25,
    message: 'Syntax Error: Expected Name, found "}".',
    severity: 8,
  };

  function renderSection(baseSchema: string) {
    urql.query.data = {
      organization: { id: 'org-1', project: { id: 'p-1', target: { id: 't-1', baseSchema } } },
    };
    return render(
      <ToastProvider>
        <TargetSettingsBaseSchemaSection />
      </ToastProvider>,
    );
  }

  const report = (markers: Array<typeof syntaxError>) =>
    act(async () => {
      schemaEditor.props?.onSyntaxErrors?.(markers);
    });

  beforeEach(() => {
    urql.mutation.data = undefined;
    urql.mutation.error = undefined;
  });

  it('shows the syntax error the editor reports under it until the schema parses again', async () => {
    renderSection('extend type Query { a: }');
    expect(schemaEditor.props?.value).toBe('extend type Query { a: }');

    await report([syntaxError]);
    expect(screen.getByText('Syntax Error: Expected Name, found "}".')).toBeTruthy();

    await report([]);
    expect(screen.queryByText('Syntax Error: Expected Name, found "}".')).toBeNull();
  });
});

describe('DangerousChangeTypeForm', () => {
  function renderForm(props: {
    considerDangerousAsBreaking?: boolean;
    failAll?: boolean;
    types?: DangerousChangeType[];
  }) {
    const element = (override: typeof props = props) => (
      <ToastProvider>
        <DangerousChangeTypeForm
          considerDangerousAsBreaking={override.considerDangerousAsBreaking ?? true}
          initialFailAllDangerousChanges={override.failAll ?? false}
          initialFailingChangeTypes={override.types ?? []}
          {...selector}
        />
      </ToastProvider>
    );
    const view = render(element());
    return { ...view, element };
  }

  const failAllBox = () => screen.getAllByRole('checkbox')[0] as HTMLElement;
  const typeBox = (label: string) =>
    screen.getByText(label).closest('div')!.querySelector('[role="checkbox"]') as HTMLElement;
  const saveButton = () =>
    screen.getByRole('button', { name: 'Save selections' }) as HTMLButtonElement;
  const click = (element: HTMLElement) =>
    act(async () => {
      fireEvent.click(element);
    });

  beforeEach(() => {
    urql.mutate.mockReset();
  });

  it('starts from the saved selection and holds Save until something changes', async () => {
    renderForm({ types: [DangerousChangeType.EnumValueAdded] });
    expect(failAllBox().getAttribute('aria-checked')).toBe('false');
    expect(typeBox('ENUM_VALUE_ADDED').getAttribute('aria-checked')).toBe('true');
    expect(typeBox('INPUT_FIELD_ADDED').getAttribute('aria-checked')).toBe('false');
    expect(saveButton().disabled).toBe(true);

    await click(typeBox('INPUT_FIELD_ADDED'));
    expect(saveButton().disabled).toBe(false);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('saves the picked types for the target and settles once the target refreshes', async () => {
    urql.mutate.mockResolvedValue({
      data: { updateTargetFailingDangerousChanges: { ok: { target: { id: 't-1' } }, error: null } },
    });
    const { rerender, element } = renderForm({ types: [DangerousChangeType.EnumValueAdded] });
    await click(typeBox('INPUT_FIELD_ADDED'));
    await click(saveButton());
    expect(urql.mutate).toHaveBeenCalledTimes(1);
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      selector,
      failingChangeTypes: [DangerousChangeType.EnumValueAdded, DangerousChangeType.InputFieldAdded],
      failAllDangerousChanges: false,
    });

    rerender(
      element({
        types: [DangerousChangeType.EnumValueAdded, DangerousChangeType.InputFieldAdded],
      }),
    );
    expect(screen.getByText('Saved just now')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('refuses an empty selection until a type or Fail All is picked', async () => {
    urql.mutate.mockResolvedValue({
      data: { updateTargetFailingDangerousChanges: { ok: { target: { id: 't-1' } }, error: null } },
    });
    renderForm({ types: [DangerousChangeType.EnumValueAdded] });
    await click(typeBox('ENUM_VALUE_ADDED'));
    await click(saveButton());
    expect(screen.getByText(/at least 1/)).toBeTruthy();
    expect(urql.mutate).not.toHaveBeenCalled();

    await click(typeBox('ENUM_VALUE_ADDED'));
    expect(screen.queryByText(/at least 1/)).toBeNull();
    await click(typeBox('ENUM_VALUE_ADDED'));
    expect(screen.getByText(/at least 1/)).toBeTruthy();

    await click(failAllBox());
    expect(screen.queryByText(/at least 1/)).toBeNull();
    expect(typeBox('ENUM_VALUE_ADDED').getAttribute('aria-disabled')).toBe('true');
    await click(saveButton());
    expect(urql.mutate).toHaveBeenCalledTimes(1);
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      selector,
      failingChangeTypes: [],
      failAllDangerousChanges: true,
    });
  });

  it('reports a refused save', async () => {
    urql.mutate.mockResolvedValue({
      data: {
        updateTargetFailingDangerousChanges: { ok: null, error: { message: 'Not allowed' } },
      },
    });
    renderForm({ types: [DangerousChangeType.EnumValueAdded] });
    await click(typeBox('INPUT_FIELD_ADDED'));
    await click(saveButton());
    expect(screen.getByText('Dangerous change types were not updated.')).toBeTruthy();
    expect(screen.getByText('Not allowed')).toBeTruthy();
  });

  it('is inert while dangerous changes are not treated as breaking', () => {
    renderForm({ considerDangerousAsBreaking: false, types: [DangerousChangeType.EnumValueAdded] });
    expect(failAllBox().getAttribute('aria-disabled')).toBe('true');
    expect(typeBox('ENUM_VALUE_ADDED').getAttribute('aria-disabled')).toBe('true');
    expect(saveButton().disabled).toBe(true);
  });
});

describe('AppDeploymentProtection', () => {
  const configuration = {
    isEnabled: true,
    minDaysInactive: 30,
    minDaysSinceCreation: 3,
    maxTrafficPercentage: 1,
    trafficPeriodDays: 30,
    ruleLogic: 'AND',
  };

  function renderSection(overrides: Partial<typeof configuration> = {}) {
    urql.query.data = {
      target: {
        id: 't-1',
        appDeploymentProtectionConfiguration: { ...configuration, ...overrides },
      },
      targets: { edges: [] },
      organization: { id: 'org-1', usageRetentionInDays: 30 },
    };
    // A fresh element each time, or React skips the update and never reads the mutation state.
    const element = () => (
      <ToastProvider>
        <AppDeploymentProtection />
      </ToastProvider>
    );
    const view = render(element());
    return { ...view, element };
  }

  const numberInput = (name: string) =>
    document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const save = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

  async function setNumber(name: string, value: string) {
    await act(async () => {
      fireEvent.change(numberInput(name), { target: { value } });
      fireEvent.blur(numberInput(name));
    });
  }

  /** The rule logic is a native select before the move and a base Select after it. */
  async function setRuleLogic(value: 'AND' | 'OR') {
    const native = document.querySelector('select[name="ruleLogic"]');
    if (native) {
      await act(async () => {
        fireEvent.change(native, { target: { value } });
      });
      return;
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: 'Rule logic' }));
    });
    const option = screen.getByRole('option', { name: value });
    await act(async () => {
      option.focus();
    });
    await act(async () => {
      fireEvent.click(option);
    });
  }

  beforeEach(() => {
    urql.mutation.data = undefined;
    urql.mutation.error = undefined;
    urql.mutate.mockReset();
  });

  it('starts from the saved configuration and rejects bad or cleared values', async () => {
    renderSection();
    expect(numberInput('minDaysSinceCreation').value).toBe('3');
    expect(numberInput('minDaysInactive').value).toBe('30');
    expect(numberInput('maxTrafficPercentage').value).toBe('1');
    expect(numberInput('trafficPeriodDays').value).toBe('30');

    await setNumber('minDaysInactive', '-1');
    expect(screen.getByText('Must be at least 0')).toBeTruthy();
    await setNumber('maxTrafficPercentage', '150');
    expect(screen.getByText('Must be at most 100')).toBeTruthy();
    await setNumber('trafficPeriodDays', '0');
    expect(screen.getByText('Must be at least 1')).toBeTruthy();
    await setNumber('minDaysSinceCreation', '1.5');
    expect(screen.getByText('Must be a whole number')).toBeTruthy();
    await setNumber('maxTrafficPercentage', '');
    expect(screen.getByText('Required')).toBeTruthy();
    await save();
    expect(urql.mutate).not.toHaveBeenCalled();
  });

  it('saves the rules for the target and confirms', async () => {
    urql.mutate.mockResolvedValue({
      data: {
        updateTargetAppDeploymentProtectionConfiguration: {
          ok: { target: { id: 't-1', appDeploymentProtectionConfiguration: configuration } },
          error: null,
        },
      },
    });
    renderSection();
    await setNumber('minDaysInactive', '14');
    await setRuleLogic('OR');
    await save();
    expect(urql.mutate).toHaveBeenCalledTimes(1);
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      input: {
        target: { bySelector: selector },
        appDeploymentProtectionConfiguration: {
          minDaysInactive: 14,
          minDaysSinceCreation: 3,
          maxTrafficPercentage: 1,
          trafficPeriodDays: 30,
          ruleLogic: 'OR',
        },
      },
    });
    expect(
      (await screen.findAllByText('App deployment protection settings updated successfully'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('shows what the server rejected under the rules', async () => {
    const result = {
      data: {
        updateTargetAppDeploymentProtectionConfiguration: {
          ok: null,
          error: {
            message: 'Invalid rules',
            inputErrors: {
              minDaysInactive: null,
              minDaysSinceCreation: null,
              maxTrafficPercentage: 'Too high for this plan',
              trafficPeriodDays: null,
            },
          },
        },
      },
    };
    urql.mutate.mockResolvedValue(result);
    const { rerender, element } = renderSection();
    await setNumber('maxTrafficPercentage', '50');
    await save();
    urql.mutation.data = result.data;
    rerender(element());
    expect(screen.getByText('Too high for this plan')).toBeTruthy();
    expect((await screen.findAllByText('Invalid rules')).length).toBeGreaterThan(0);
  });

  it('switches protection on and off straight away and greys the rules out while off', async () => {
    urql.mutate.mockResolvedValue({ data: {} });
    renderSection();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      input: {
        target: { bySelector: selector },
        appDeploymentProtectionConfiguration: { isEnabled: false },
      },
    });
    expect(numberInput('minDaysInactive').closest('.opacity-25')).toBeNull();

    renderSection({ isEnabled: false });
    expect(
      (document.querySelectorAll('input[name="minDaysInactive"]')[1] as HTMLElement).closest(
        '.opacity-25',
      ),
    ).not.toBeNull();
  });
});

describe('BreakingChanges', () => {
  const configuration = {
    isEnabled: true,
    period: 30,
    percentage: 5,
    requestCount: 1,
    breakingChangeFormula: 'PERCENTAGE',
    targets: [{ id: 't-1', slug: 'production' }],
    excludedClients: ['legacy-app'],
    excludedAppDeployments: ['ios@1.0'],
  };

  /** One query stub serves the settings query and the two exclusion pickers' queries. */
  function renderSection(overrides: Partial<typeof configuration> = {}) {
    urql.query.data = {
      target: {
        id: 't-1',
        failDiffOnDangerousChange: true,
        failAllDangerousChanges: true,
        failDangerousChangeTypes: [],
        conditionalBreakingChangeConfiguration: { ...configuration, ...overrides },
        appDeploymentProtectionConfiguration: null,
        appDeployments: { edges: [] },
      },
      targets: {
        edges: [
          { node: { id: 't-1', slug: 'production' } },
          { node: { id: 't-2', slug: 'staging' } },
        ],
      },
      organization: { id: 'org-1', usageRetentionInDays: 30 },
      clientStatsByTargets: { edges: [] },
    };
    // A fresh element each time, or React skips the update and never reads the mutation state.
    const element = () => (
      <ToastProvider>
        <BreakingChanges />
      </ToastProvider>
    );
    const view = render(element());
    return { ...view, element };
  }

  const numberInput = (name: string) =>
    document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const targetBox = (slug: string) =>
    screen
      .getByText(slug, { selector: 'label' })
      .closest('div')!
      .querySelector('[role="checkbox"]') as HTMLElement;
  const save = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

  async function setNumber(name: string, value: string) {
    await act(async () => {
      fireEvent.change(numberInput(name), { target: { value } });
      fireEvent.blur(numberInput(name));
    });
  }

  beforeEach(() => {
    urql.mutation.data = undefined;
    urql.mutation.error = undefined;
    urql.mutate.mockReset();
  });

  it('starts from the saved configuration', () => {
    renderSection();
    expect(
      screen.getByRole('radio', { name: 'Percent of Traffic' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(numberInput('percentage').value).toBe('5');
    expect(numberInput('period').value).toBe('30');
    expect(targetBox('production').getAttribute('aria-checked')).toBe('true');
    expect(targetBox('staging').getAttribute('aria-checked')).toBe('false');
  });

  it('needs a target and a percentage, and keeps the period within retention', async () => {
    renderSection();
    await act(async () => {
      fireEvent.click(targetBox('production'));
    });
    expect(targetBox('production').getAttribute('aria-checked')).toBe('false');
    await save();
    // The Formik version blocked this save silently; the message is new with the move.
    expect(screen.getByText(/at least 1/)).toBeTruthy();
    expect(urql.mutate).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(targetBox('production'));
    });
    await setNumber('percentage', '');
    expect(screen.getByText('Required')).toBeTruthy();
    await setNumber('period', '45');
    expect(screen.getByText(/(less than or equal to|at most) 30/)).toBeTruthy();
    await save();
    expect(urql.mutate).not.toHaveBeenCalled();
  });

  it('takes only whole request counts, then saves the configuration and confirms', async () => {
    urql.mutate.mockResolvedValue({
      data: {
        updateTargetConditionalBreakingChangeConfiguration: {
          ok: { target: { id: 't-1' } },
          error: null,
        },
      },
    });
    renderSection();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Total Operations' }));
    });
    await setNumber('requestCount', '2.5');
    expect(screen.getByText('Must be a whole number')).toBeTruthy();
    await setNumber('requestCount', '250');
    expect(screen.queryByText('Must be a whole number')).toBeNull();
    await setNumber('period', '14');
    await act(async () => {
      fireEvent.click(targetBox('staging'));
    });
    await save();
    expect(urql.mutate).toHaveBeenCalledTimes(1);
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      input: {
        target: { bySelector: selector },
        conditionalBreakingChangeConfiguration: {
          percentage: 5,
          requestCount: 250,
          period: 14,
          breakingChangeFormula: 'REQUEST_COUNT',
          targetIds: ['t-1', 't-2'],
          excludedClients: ['legacy-app'],
          excludedAppDeployments: ['ios@1.0'],
        },
      },
    });
    expect(
      (await screen.findAllByText('Conditional breaking changes settings updated successfully'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('shows what the server rejected under the numbers', async () => {
    const result = {
      data: {
        updateTargetConditionalBreakingChangeConfiguration: {
          ok: null,
          error: {
            message: 'Invalid configuration',
            inputErrors: { percentage: null, period: 'Period too long', requestCount: null },
          },
        },
      },
    };
    urql.mutate.mockResolvedValue(result);
    const { rerender, element } = renderSection();
    await setNumber('period', '20');
    await save();
    urql.mutation.data = result.data;
    rerender(element());
    expect(screen.getByText('Period too long')).toBeTruthy();
    expect((await screen.findAllByText('Invalid configuration')).length).toBeGreaterThan(0);
  });

  it('flips both switches straight away and greys the rules out while off', async () => {
    urql.mutate.mockResolvedValue({ data: {} });
    renderSection();
    const [dangerousSwitch, conditionalSwitch] = screen.getAllByRole('switch');
    await act(async () => {
      fireEvent.click(conditionalSwitch);
    });
    expect(urql.mutate.mock.calls[0][0]).toEqual({
      input: {
        target: { bySelector: selector },
        conditionalBreakingChangeConfiguration: { isEnabled: false },
      },
    });
    await act(async () => {
      fireEvent.click(dangerousSwitch);
    });
    expect(urql.mutate.mock.calls[1][0]).toEqual({
      input: { failDiffOnDangerousChange: false, target: { bySelector: selector } },
    });
    expect(numberInput('period').closest('.opacity-25')).toBeNull();

    renderSection({ isEnabled: false });
    expect(
      (document.querySelectorAll('input[name="period"]')[1] as HTMLElement).closest('.opacity-25'),
    ).not.toBeNull();
  });
});
