// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ScopeBar } from './scope-bar';

describe('ScopeBar', () => {
  it('labels the picker', () => {
    render(<ScopeBar picker={<button type="button">Default Graph</button>} />);
    expect(screen.getByText('Viewing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Default Graph' })).toBeTruthy();
  });

  it('takes a custom label', () => {
    render(<ScopeBar label="Graph" picker={<span>Default Graph</span>} />);
    expect(screen.getByText('Graph')).toBeTruthy();
  });
});
