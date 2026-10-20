// @vitest-environment jsdom
import { makeFragmentData } from '@/gql';
import { render } from '@testing-library/react';
import { CompositionErrorsCard } from './composition-errors-card';
import { CompositionErrorsSection_SchemaErrorConnection } from './errors-and-changes';

function errors(...messages: string[]) {
  return makeFragmentData(
    {
      __typename: 'SchemaErrorConnection' as const,
      edges: messages.map(message => ({
        __typename: 'SchemaErrorEdge' as const,
        node: { __typename: 'SchemaError' as const, message },
      })),
    },
    CompositionErrorsSection_SchemaErrorConnection,
  );
}

describe('CompositionErrorsCard', () => {
  it('counts one error in the singular', () => {
    const { getByText } = render(
      <CompositionErrorsCard compositionErrors={errors('Unknown type "Foo".')} />,
    );
    getByText('1 error');
  });

  it('counts several errors in the plural and numbers each row', () => {
    const { getByText, container } = render(
      <CompositionErrorsCard
        compositionErrors={errors('Unknown type "Foo".', 'Unknown type "Bar".')}
      />,
    );
    getByText('2 errors');
    const rows = [...container.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.querySelector('span')?.textContent)).toEqual(['01', '02']);
  });
});
