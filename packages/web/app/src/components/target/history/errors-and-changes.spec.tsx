// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { CompositionErrorsList, labelize } from './errors-and-changes';

describe('labelize', () => {
  it('wraps single- and double-quoted segments in a Label and drops the quotes', () => {
    const { container } = render(<>{labelize('Field "User.id" conflicts with \'Account.id\'')}</>);
    const labels = [...container.querySelectorAll('span')].map(label => label.textContent);
    expect(labels).toEqual(['User.id', 'Account.id']);
    expect(container.textContent).toBe('Field User.id conflicts with Account.id');
  });

  it('leaves a message without quotes untouched', () => {
    const { container } = render(<>{labelize('Composition succeeded')}</>);
    expect(container.querySelectorAll('span')).toHaveLength(0);
    expect(container.textContent).toBe('Composition succeeded');
  });
});

describe('CompositionErrorsList', () => {
  it('renders the title and lifts a satisfiability query into a code block', () => {
    const query = '{\n  user {\n    orders\n  }\n}';
    const { container, getByText } = render(
      <CompositionErrorsList
        title="Composition Errors"
        errors={[
          {
            message: `The following supergraph API query:\n${query}\ncannot be satisfied by the subgraphs because:\n- from subgraph "users": cannot find field "User.orders".`,
          },
        ]}
      />,
    );
    getByText('Composition Errors');
    expect(container.querySelector('pre')?.textContent).toBe(query);
    // The same section heading as the change lists, with its explainer beside it.
    const heading = container.querySelector('[data-cy="composition-errors-title"]')!;
    expect(heading.textContent).toContain('Composition Errors');
    expect(heading.querySelector('[data-cy="composition-errors-info"]')).toBeTruthy();
  });
});
