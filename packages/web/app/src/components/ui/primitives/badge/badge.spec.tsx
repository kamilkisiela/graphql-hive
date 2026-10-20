// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it.each(['success', 'warning', 'critical', 'info'] as const)(
    'sets %s text in its text token, not the hue the tint is made from',
    variant => {
      const { container } = render(<Badge content="label" variants={{ variant }} />);
      const className = container.firstElementChild!.className;
      expect(className).toContain(`bg-${variant}-tint`);
      expect(className).toContain(`text-${variant}-text`);
    },
  );

  it('stays the outermost element when it carries a tooltip, so it sits in a row like any other', () => {
    const { container } = render(
      <Badge
        content="2 clients"
        tooltip="10 operations by 2 clients affected"
        variants={{ variant: 'critical' }}
      />,
    );
    const badge = container.firstElementChild!;
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('bg-critical-tint');
    expect(badge.textContent).toBe('2 clients');
    expect(container.children).toHaveLength(1);
  });
});
