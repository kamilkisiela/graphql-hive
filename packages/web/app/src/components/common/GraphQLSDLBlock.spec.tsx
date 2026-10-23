// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { GraphQLHighlight } from './GraphQLSDLBlock';

/** Records what the mocked editor was rendered with. */
const editor = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock('@/components/schema-editor', () => ({
  SchemaEditor: (props: Record<string, unknown>) => {
    editor.props = props;
    return <div data-testid="schema-editor" />;
  },
}));

describe('GraphQLHighlight', () => {
  it('stays read-only when the caller passes its own editor options', () => {
    render(
      <GraphQLHighlight
        code="type Query { a: String }"
        height="100%"
        options={{ fontSize: 10, minimap: { enabled: false } }}
      />,
    );

    expect(editor.props?.options).toEqual({
      readOnly: true,
      fontSize: 10,
      minimap: { enabled: false },
    });
    expect(editor.props?.height).toBe('100%');
  });

  it('is read-only with the default height when no options are passed', () => {
    render(<GraphQLHighlight code="type Query { a: String }" className="pt-6" />);

    expect(editor.props?.options).toEqual({ readOnly: true });
    expect(editor.props?.height).toBe('100vh');
    expect(editor.props?.className).toBe('pt-6');
  });
});
