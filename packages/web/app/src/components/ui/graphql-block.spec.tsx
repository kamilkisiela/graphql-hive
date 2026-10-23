// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { GraphQLBlock, GraphQLHighlight } from './graphql-block';

/** Records what the mocked code block was rendered with. */
const codeBlock = vi.hoisted(() => ({
  file: undefined as Record<string, unknown> | undefined,
  scrollAreaClassName: undefined as string | undefined,
}));

vi.mock('@/components/ui/diffs', () => ({
  CodeScrollArea: (props: { className?: string; children: ReactNode }) => {
    codeBlock.scrollAreaClassName = props.className;
    return <div>{props.children}</div>;
  },
  File: (props: Record<string, unknown>) => {
    codeBlock.file = props;
    return <div data-testid="code-block" />;
  },
}));

describe('GraphQLHighlight', () => {
  it('renders the document pretty-printed as a headerless GraphQL code block', () => {
    render(<GraphQLHighlight code="type Query { a: String }" className="h-full" />);

    expect(screen.getByTestId('code-block')).toBeTruthy();
    expect(codeBlock.file).toEqual({
      file: { name: 'document.graphql', contents: 'type Query {\n  a: String\n}' },
      options: { disableFileHeader: true },
    });
    expect(codeBlock.scrollAreaClassName).toBe('h-full');
  });

  it('shows a document that does not parse as it is', () => {
    render(<GraphQLHighlight code="type Query {" />);

    expect(codeBlock.file).toMatchObject({ file: { contents: 'type Query {' } });
  });
});

describe('GraphQLBlock', () => {
  it('frames the SDL with its title and service url', () => {
    render(<GraphQLBlock sdl="type Query { a: String }" url="https://reviews.example" />);

    expect(screen.getByText('SDL')).toBeTruthy();
    expect(screen.getByText('https://reviews.example')).toBeTruthy();
    expect(codeBlock.file).toMatchObject({
      file: { contents: 'type Query {\n  a: String\n}' },
    });
  });
});
