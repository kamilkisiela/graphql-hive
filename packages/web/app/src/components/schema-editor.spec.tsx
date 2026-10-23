// @vitest-environment jsdom
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
