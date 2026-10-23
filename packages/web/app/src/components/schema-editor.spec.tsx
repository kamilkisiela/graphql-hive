// @vitest-environment jsdom
import type { OnMount } from '@monaco-editor/react';
import { render, screen } from '@testing-library/react';
import { SchemaEditor } from './schema-editor';

/** Records what the mocked Monaco editor was rendered with. */
const monaco = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

// Monaco cannot mount in jsdom, and skipping its modules keeps the spec fast.
vi.mock('monaco-editor/esm/vs/editor/editor.api', () => ({}));
vi.mock('monaco-editor/esm/vs/editor/contrib/readOnlyMessage/browser/contribution.js', () => ({}));
vi.mock('monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution.js', () => ({}));
vi.mock('monaco-editor/esm/vs/language/json/monaco.contribution.js', () => ({}));
vi.mock('@monaco-editor/react', () => ({
  loader: { config: () => {} },
  Editor: (props: Record<string, unknown>) => {
    monaco.props = props;
    return <div data-testid="monaco" />;
  },
  DiffEditor: () => null,
}));
vi.mock('@/components/theme/theme-provider', () => ({
  useMonacoTheme: () => 'vs-dark',
}));

describe('SchemaEditor', () => {
  it('renders Monaco as a GraphQL editor in the app theme', () => {
    render(
      <SchemaEditor value="type Query { a: String }" height={300} options={{ readOnly: true }} />,
    );

    expect(screen.getByTestId('monaco')).toBeTruthy();
    expect(monaco.props).toMatchObject({
      language: 'graphql',
      theme: 'vs-dark',
      value: 'type Query { a: String }',
      height: 300,
      options: { readOnly: true },
    });
  });

  it('lets an explicit theme win over the app theme', () => {
    render(<SchemaEditor value="" theme="vs" />);

    expect(monaco.props?.theme).toBe('vs');
  });
});

describe('SchemaEditor onSyntaxErrors', () => {
  const brokenSdl = 'extend type Query { a: }';
  const brokenSdlMarker = {
    startLineNumber: 1,
    startColumn: 24,
    endLineNumber: 1,
    endColumn: 25,
    message: 'Syntax Error: Expected Name, found "}".',
    severity: 8,
  };

  /** Stands in for the editor and monaco instances the wrapper hands to `onMount`. */
  function fakeMonaco(initialText: string) {
    let text = initialText;
    const model = { getValue: () => text };
    const contentListeners: Array<() => void> = [];
    const disposeListeners: Array<() => void> = [];
    const subscription = { dispose: vi.fn() };
    const editor = {
      getModel: () => model,
      onDidChangeModelContent: vi.fn((listener: () => void) => {
        contentListeners.push(listener);
        return subscription;
      }),
      onDidDispose: vi.fn((listener: () => void) => {
        disposeListeners.push(listener);
        return { dispose: vi.fn() };
      }),
    };
    const instance = { editor: { setModelMarkers: vi.fn() } };
    return {
      model,
      editor,
      instance,
      subscription,
      mount: () => (monaco.props?.onMount as OnMount)(editor as never, instance as never),
      edit: (next: string) => {
        text = next;
        for (const listener of contentListeners) {
          listener();
        }
      },
      dispose: () => {
        for (const listener of disposeListeners) {
          listener();
        }
      },
    };
  }

  it('marks syntax errors on mount and after every edit, and reports them', () => {
    const onSyntaxErrors = vi.fn();
    render(<SchemaEditor value="type Query { a: String }" onSyntaxErrors={onSyntaxErrors} />);
    const fake = fakeMonaco('type Query { a: String }');

    fake.mount();
    expect(fake.instance.editor.setModelMarkers).toHaveBeenLastCalledWith(
      fake.model,
      'graphql',
      [],
    );
    expect(onSyntaxErrors).toHaveBeenLastCalledWith([]);

    fake.edit(brokenSdl);
    expect(fake.instance.editor.setModelMarkers).toHaveBeenLastCalledWith(fake.model, 'graphql', [
      brokenSdlMarker,
    ]);
    expect(onSyntaxErrors).toHaveBeenLastCalledWith([brokenSdlMarker]);

    fake.edit('');
    expect(onSyntaxErrors).toHaveBeenLastCalledWith([]);
  });

  it('stops listening once the editor is disposed', () => {
    render(<SchemaEditor value="" onSyntaxErrors={() => {}} />);
    const fake = fakeMonaco('');

    fake.mount();
    fake.dispose();
    expect(fake.subscription.dispose).toHaveBeenCalledTimes(1);
  });

  it('leaves the editor alone without the prop and still forwards onMount', () => {
    const onMount = vi.fn();
    render(<SchemaEditor value={brokenSdl} onMount={onMount} />);
    const fake = fakeMonaco(brokenSdl);

    fake.mount();
    expect(fake.instance.editor.setModelMarkers).not.toHaveBeenCalled();
    expect(fake.editor.onDidChangeModelContent).not.toHaveBeenCalled();
    expect(onMount).toHaveBeenCalledWith(fake.editor, fake.instance);
  });
});
