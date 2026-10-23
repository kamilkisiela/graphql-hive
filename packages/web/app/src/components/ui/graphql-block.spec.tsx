// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { GraphQLBlock, GraphQLHighlight } from './graphql-block';

/** Records what the mocked editor was rendered with. */
const editor = vi.hoisted(() => ({ props: undefined as Record<string, unknown> | undefined }));

vi.mock('@/components/schema-editor', () => ({
  SchemaEditor: (props: Record<string, unknown>) => {
    editor.props = props;
    return <div data-testid="schema-editor" />;
  },
}));

describe('GraphQLHighlight', () => {
  it('stays read-only with line numbers when the caller passes its own editor options', () => {
    render(<GraphQLHighlight code="type Query { a: String }" options={{ fontSize: 10 }} />);

    expect(editor.props?.options).toEqual({ readOnly: true, lineNumbers: 'on', fontSize: 10 });
    expect(editor.props?.height).toBe('60vh');
  });
});

describe('GraphQLBlock', () => {
  it('passes editorProps through and keeps the editor read-only', () => {
    render(<GraphQLBlock sdl="type Query { a: String }" editorProps={{ options: { fontSize: 10 } }} />);

    expect(screen.getByText('SDL')).toBeTruthy();
    expect(editor.props?.options).toEqual({ readOnly: true, lineNumbers: 'on', fontSize: 10 });
  });
});
