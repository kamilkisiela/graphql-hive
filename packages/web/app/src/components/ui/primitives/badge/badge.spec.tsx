// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Badge } from './badge';
import * as styles from './badge.css';

describe('Badge', () => {
  it.each(['success', 'warning', 'critical', 'info'] as const)(
    'sets %s text in its text token, not the hue the tint is made from',
    variant => {
      const { container } = render(<Badge content="label" variants={{ variant }} />);
      const className = container.firstElementChild!.className;
      expect(className).toContain(styles.badgeVariants.classNames.variants.variant[variant]);
    },
  );
});
