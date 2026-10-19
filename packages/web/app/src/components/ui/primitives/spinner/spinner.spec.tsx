// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Spinner } from './spinner';
import * as styles from './spinner.css';

describe('Spinner', () => {
  it('announces itself as a status and spins the accent icon at the default size', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-label')).toBe('Loading');
    const icon = status.querySelector('svg') as SVGElement;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const { base, variants } = styles.spinnerVariants.classNames;
    expect(icon.getAttribute('class')).toContain(base);
    expect(icon.getAttribute('class')).toContain(variants.tone.accent);
    expect(icon.getAttribute('class')).toContain(variants.size.default);
  });

  it('takes a label and a size', () => {
    render(<Spinner label="Loading app deployments" variants={{ size: 'sm' }} />);
    const status = screen.getByLabelText('Loading app deployments');
    expect(status.querySelector('svg')?.getAttribute('class')).toContain(
      styles.spinnerVariants.classNames.variants.size.sm,
    );
  });

  it('takes the text color around it when the tone is current', () => {
    render(<Spinner variants={{ tone: 'current' }} />);
    expect(screen.getByRole('status').querySelector('svg')?.getAttribute('class')).not.toContain(
      styles.spinnerVariants.classNames.variants.tone.accent,
    );
  });
});
