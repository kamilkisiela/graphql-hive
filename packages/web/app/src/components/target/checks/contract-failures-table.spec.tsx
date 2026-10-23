// @vitest-environment jsdom
import { formatCount } from '@/lib/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { ContractFailuresTable } from './contract-failures-table';

describe('ContractFailuresTable', () => {
  it('names each failure with its reason and scopes the page from its row', () => {
    const onView = vi.fn();
    const { container } = render(
      <ContractFailuresTable
        title="2 of 11 contracts failed"
        aside="9 passed"
        items={[
          {
            key: 'mobile',
            label: 'mobile',
            reason: 'Composition failed.',
            detail: '2 errors',
            onView: () => onView('mobile'),
          },
          { key: 'billing', label: 'billing', reason: 'Unapproved breaking changes!' },
        ]}
      />,
    );
    expect(screen.getByText('2 of 11 contracts failed')).toBeTruthy();
    expect(screen.getByText('9 passed')).toBeTruthy();
    // No column headers: the title bar names the table.
    expect(container.querySelector('thead')).toBeNull();
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('mobile');
    expect(rows[0].textContent).toContain('Composition failed.2 errors');
    expect(rows[1].textContent).toContain('Unapproved breaking changes!');

    // Only the row with a handler gets a button.
    expect(screen.getAllByRole('button', { name: 'View contract' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'View contract' }));
    expect(onView).toHaveBeenCalledWith('mobile');
  });

  it('renders nothing without items', () => {
    const { container } = render(
      <ContractFailuresTable title="0 of 11 contracts failed" items={[]} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('counts in the singular and the plural', () => {
    expect(formatCount(1, 'error')).toBe('1 error');
    expect(formatCount(3, 'breaking change')).toBe('3 breaking changes');
  });
});
