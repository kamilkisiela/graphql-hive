// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ChangeBlock } from './change-detail';

const fieldAdded = {
  type: 'FIELD_ADDED',
  message: "Field 'products' was added to object type 'Query'",
  path: 'Query.products',
  criticality: { level: 'NON_BREAKING' },
  meta: {},
} as never;

describe('ChangeBlock', () => {
  it('heads its section like the check page, and leaves a change with no error closed', () => {
    render(
      <ChangeBlock
        title="Safe Changes"
        info="Changes that are safe."
        changes={[{ change: fieldAdded }]}
      />,
    );

    const heading = screen.getByRole('heading', { name: /Safe Changes/ });
    expect(heading.className).toContain('text-base');
    expect(screen.getByRole('button', { name: 'More about this change' })).toBeTruthy();
    // Nothing to open: the row is a static heading, not a button.
    expect(screen.queryByRole('button', { name: /was added to object type/ })).toBeNull();
  });

  it('still opens a change to its error', () => {
    render(
      <ChangeBlock
        title="Safe Changes"
        info=""
        changes={[{ change: fieldAdded, error: new Error('Field already exists.') }]}
      />,
    );

    expect(screen.getByRole('button', { name: /was added to object type/ })).toBeTruthy();
  });
});
